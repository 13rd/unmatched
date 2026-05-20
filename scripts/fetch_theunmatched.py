#!/usr/bin/env python3
"""
Fetch character data from the-unmatched.club and generate character JSON.

Usage:
    python3 scripts/fetch_theunmatched.py <url_or_id>
    python3 scripts/fetch_theunmatched.py галан.843
    python3 scripts/fetch_theunmatched.py https://www.the-unmatched.club/c/heroes/галан.843

Output:
    - Character JSON written to heroes/characters/<safe_name>.json
    - Images downloaded to uploads/
    - Result JSON printed to stdout
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import argparse
import requests

BASE_URL = 'https://www.the-unmatched.club'
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def fetch_page_html(url):
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.content.decode('utf-8')


def extract_hero_data(html):
    idx = html.find('kit.start(app, element,')
    if idx < 0:
        raise ValueError('No kit.start() call found in page HTML')
    brace_idx = html.find('{', idx)
    depth = 0
    end_idx = brace_idx
    for i in range(brace_idx, len(html)):
        if html[i] == '{':
            depth += 1
        elif html[i] == '}':
            depth -= 1
            if depth == 0:
                end_idx = i + 1
                break
    js_obj = html[brace_idx:end_idx]

    data_match = re.search(r'data:\s*\[', js_obj)
    if not data_match:
        raise ValueError('No data array found')
    arr_start = js_obj.find('[', data_match.start())
    depth = 1
    i = arr_start + 1
    while depth > 0 and i < len(js_obj):
        if js_obj[i] == '[':
            depth += 1
        elif js_obj[i] == ']':
            depth -= 1
        i += 1
    data_arr_str = js_obj[arr_start:i]

    matches = list(re.finditer(r'\{type:"data"', data_arr_str))
    if len(matches) < 3:
        raise ValueError(f'Expected 3+ data elements, found {len(matches)}')
    element_start = matches[2].start()
    depth = 0
    element_end = element_start
    for i in range(element_start, len(data_arr_str)):
        if data_arr_str[i] == '{':
            depth += 1
        elif data_arr_str[i] == '}':
            depth -= 1
            if depth == 0:
                element_end = i + 1
                break
    return data_arr_str[element_start:element_end]


def parse_js_literal_with_node(js_literal):
    node_script = f"""
const obj = eval('(' + {json.dumps(js_literal)} + ')');
console.log(JSON.stringify(obj.data));
"""
    result = subprocess.run(
        ['node', '-e', node_script],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        raise ValueError(f'Node parse failed: {result.stderr}')
    return json.loads(result.stdout)


def safe_name(name):
    safe = name.lower().replace(' ', '_').replace('-', '_')
    return re.sub(r'[^a-zа-яё0-9_]', '', safe)


def download_image(url, dest_path, retries=2):
    if not url:
        return None
    if url.startswith('//'):
        url = 'https:' + url
    elif url.startswith('/'):
        url = BASE_URL + url
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    for attempt in range(retries + 1):
        try:
            resp = requests.get(url, timeout=30, headers=headers)
            resp.raise_for_status()
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            with open(dest_path, 'wb') as f:
                f.write(resp.content)
            return dest_path
        except Exception as e:
            if attempt < retries:
                continue
            print(f'  download failed: {e}', file=sys.stderr)
            return None


def extract_text(node):
    """Recursively extract plain text from a ProseMirror rich text node."""
    if node is None:
        return ''
    if isinstance(node, dict):
        if 'text' in node:
            return node['text']
        if node.get('type') == 'paragraph':
            return ''.join(extract_text(c) for c in node.get('content', []))
        parts = [extract_text(c) for c in node.get('content', [])]
        return ' '.join(p for p in parts if p)
    if isinstance(node, list):
        parts = [extract_text(c) for c in node]
        return ' '.join(p for p in parts if p)
    return ''


def parse_doc(doc):
    """
    Parse a ProseMirror card/ability doc into { name, effects }.
    Effects keyed by phase: default, immediately, during_combat, after_combat, ongoing.
    """
    if not isinstance(doc, dict):
        return {'name': '', 'effects': {}}

    name = ''
    effects = {}

    for node in doc.get('content', []):
        node_type = node.get('type', '')
        if node_type == 'heading':
            texts = [c.get('text', '') for c in node.get('content', []) if isinstance(c, dict)]
            name = ''.join(texts).strip()
        elif node_type.startswith('cardEffect'):
            phase = node.get('attrs', {}).get('effect', '')
            paragraphs = [extract_text(c).strip() for c in node.get('content', [])]
            text = '\n'.join(p for p in paragraphs if p)
            if text and phase:
                effects[phase] = text

    return {'name': name, 'effects': effects}


def parse_rich_text(doc):
    """Extract all paragraphs from a generic rich text doc as a list of {heading, text} sections."""
    if not isinstance(doc, dict):
        return []
    sections = []
    current_heading = ''
    for node in doc.get('content', []):
        node_type = node.get('type', '')
        if node_type == 'heading':
            texts = [c.get('text', '') for c in node.get('content', []) if isinstance(c, dict)]
            current_heading = ''.join(texts).strip()
        elif node_type == 'paragraph':
            text = extract_text(node).strip()
            if text:
                sections.append({'heading': current_heading, 'text': text})
                current_heading = ''
    return sections


def extract_special_ability(char_obj):
    """Extract special ability { name, text } from character object."""
    i18n_ru = char_obj.get('i18n', {}).get('ru', {})
    doc = i18n_ru.get('specialAbility') or char_obj.get('specialAbility')
    if not isinstance(doc, dict):
        return None
    # Special abilities use heading + paragraph nodes (not cardEffect nodes)
    name = ''
    for node in doc.get('content', []):
        if node.get('type') == 'heading':
            texts = [c.get('text', '') for c in node.get('content', []) if isinstance(c, dict)]
            name = ''.join(texts).strip()
            break
    sections = parse_rich_text(doc)
    text = ' '.join(s['text'] for s in sections)
    return {'name': name, 'text': text} if name or text else None


def extract_rule_cards(rule_cards_raw):
    """Convert raw ruleCards array to list of { title, sections: [{heading, text}] }."""
    result = []
    for rc in rule_cards_raw:
        i18n_ru = rc.get('i18n', {}).get('ru', {})
        title = (i18n_ru.get('title') or rc.get('title', '')).strip()
        doc = i18n_ru.get('content') or rc.get('content', {})
        sections = parse_rich_text(doc)
        result.append({'title': title, 'sections': sections})
    return result


def try_extract_sidekick_speed(rule_cards_raw):
    """Try to parse sidekick movement speed from rule cards text."""
    for rc in rule_cards_raw:
        i18n_ru = rc.get('i18n', {}).get('ru', {})
        doc = i18n_ru.get('content') or rc.get('content', {})
        full_text = extract_text(doc).lower()
        match = re.search(r'скорость[^.]*?(\d+)', full_text)
        if match:
            return int(match.group(1))
    return None


def get_rendered_card_screenshots(hero_url, safe, uploads_dir, project_dir):
    """
    Run headless Chrome to screenshot rendered card images from the export page.
    Returns (card_images: {index: rel_path}, charcard_images: [rel_path, ...]).
    Falls back to ({}, []) on error.
    """
    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshot_cards.js')
    if not os.path.exists(script_path):
        return {}, []

    temp_dir = tempfile.mkdtemp(prefix=f'{safe}_cards_')
    try:
        result = subprocess.run(
            ['node', script_path, hero_url, temp_dir],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0 or not result.stdout.strip():
            print(f'  screenshot failed: {result.stderr[:200]}', file=sys.stderr)
            return {}, []

        data = json.loads(result.stdout)
        os.makedirs(uploads_dir, exist_ok=True)

        card_images = {}
        for item in data.get('cards', []):
            src = item['path']
            if os.path.exists(src):
                dest = os.path.join(uploads_dir, f'{safe}_card_{item["index"]}.png')
                shutil.copy2(src, dest)
                card_images[item['index']] = '/' + os.path.relpath(dest, project_dir).replace('\\', '/')

        charcard_images = []
        for item in data.get('charCards', []):
            src = item['path']
            if os.path.exists(src):
                dest = os.path.join(uploads_dir, f'{safe}_charcard_{item["index"]}.png')
                shutil.copy2(src, dest)
                charcard_images.append('/' + os.path.relpath(dest, project_dir).replace('\\', '/'))

        return card_images, charcard_images

    except (subprocess.TimeoutExpired, json.JSONDecodeError, ValueError) as e:
        print(f'  screenshot error: {e}', file=sys.stderr)
        return {}, []
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def build_card_entry(card, safe_prefix, uploads_dir, project_dir, card_index, rendered_image=None):
    """Build a card dict with all mechanical data. Uses rendered_image if provided, else downloads art."""
    i18n_ru = card.get('i18n', {}).get('ru', {})

    desc = parse_doc(i18n_ru.get('description') or card.get('description', {}))
    banner_name = (i18n_ru.get('bannerName') or card.get('bannerName', '')).strip()
    card_name = desc['name'] or banner_name or str(card.get('id', ''))

    img_rel = rendered_image
    if not img_rel:
        art_url = card.get('art', '') or card.get('replacementImage', '')
        if art_url:
            ext = os.path.splitext(art_url.split('?')[0])[1] or '.png'
            dest = os.path.join(uploads_dir, f'{safe_prefix}_card_{card_index}{ext}')
            if download_image(art_url, dest):
                img_rel = '/' + os.path.relpath(dest, project_dir).replace('\\', '/')

    entry = {
        'image': img_rel,
        'text': card_name,
        'type': card.get('type', ''),
        'value': int(card['value']) if card.get('value') is not None else 0,
        'boost': int(card['boostValue']) if card.get('boostValue') is not None else 0,
        'effects': desc['effects'],
    }

    if card.get('additionalAction'):
        add_desc = parse_doc(
            i18n_ru.get('additionalActionDescription') or card.get('additionalActionDescription', {})
        )
        entry['additionalAction'] = {
            'type': card.get('additionalActionType', ''),
            'value': int(card['additionalActionValue']) if card.get('additionalActionValue') is not None else 0,
            'position': card.get('additionalActionPosition', ''),
            'name': add_desc['name'],
            'effects': add_desc['effects'],
        }

    return entry


def main():
    parser = argparse.ArgumentParser(description='Fetch character from the-unmatched.club')
    parser.add_argument('url_or_id', help='Hero URL or ID (e.g. галан.843)')
    parser.add_argument('--project-dir', default=PROJECT_DIR, help='Project root (default: auto)')
    args = parser.parse_args()

    project_dir = os.path.abspath(args.project_dir)
    uploads_dir = os.path.join(project_dir, 'uploads')
    chars_dir = os.path.join(project_dir, 'heroes', 'characters')

    url_or_id = args.url_or_id
    if not url_or_id.startswith('http'):
        url_or_id = f'{BASE_URL}/c/heroes/{url_or_id}'

    print(f'Fetching: {url_or_id}', file=sys.stderr)
    html = fetch_page_html(url_or_id)
    js_literal = extract_hero_data(html)
    print(f'Data extracted ({len(js_literal)} chars), parsing...', file=sys.stderr)
    data = parse_js_literal_with_node(js_literal)

    hero = data['hero']
    cards = data.get('cards', [])

    chars = hero.get('characters', [])
    main_char = chars[0] if chars else {}
    char_i18n = main_char.get('i18n', {}).get('ru', {})

    display_name = char_i18n.get('name', '') or hero.get('title', '') or hero.get('key', 'unknown')
    hp = int(main_char['hp']) if main_char.get('hp') is not None else None
    move_val = int(main_char['move']) if main_char.get('move') is not None else None
    attack_type = main_char.get('attack')
    char_color = (main_char.get('appearance', {}).get('borderColor')
                  or hero.get('appearance', {}).get('characterCardBorder')
                  or hero.get('appearance', {}).get('actionCardBorder'))

    print(f'Character: {display_name}, HP: {hp}, Move: {move_val}, Attack: {attack_type}', file=sys.stderr)

    safe = safe_name(display_name)

    # Token image — only from direct avatar fields, not background/pattern
    token_url = ((main_char.get('externalAvatar') or '').strip()
                 or (main_char.get('customImage') or '').strip()
                 or (main_char.get('avatar') or '').strip())
    token_rel = None
    if token_url:
        dest = os.path.join(uploads_dir, f'{safe}_token.png')
        if download_image(token_url, dest):
            token_rel = '/' + os.path.relpath(dest, project_dir).replace('\\', '/')
            print('Token: downloaded', file=sys.stderr)
    else:
        print('Token: no avatar URL found', file=sys.stderr)

    # Deck back image
    back_url = hero.get('cardsBack', '')
    cover_rel = None
    if back_url:
        dest = os.path.join(uploads_dir, f'{safe}_back.png')
        if download_image(back_url, dest):
            cover_rel = '/' + os.path.relpath(dest, project_dir).replace('\\', '/')
            print('Back: downloaded', file=sys.stderr)

    # Special ability
    special_ability = extract_special_ability(main_char)

    # Quote
    quote_text = char_i18n.get('quoteText', '').strip()
    quote_author = char_i18n.get('quoteAuthor', '').strip()
    quote = {'text': quote_text, 'author': quote_author} if quote_text or quote_author else None

    # Rule cards
    rule_cards_raw = hero.get('ruleCards', [])
    rule_cards = extract_rule_cards(rule_cards_raw)

    # Render cards via headless Chrome (gets full card visuals with text/stats)
    print('Rendering cards via headless Chrome...', file=sys.stderr)
    rendered_images, charcard_images = get_rendered_card_screenshots(
        url_or_id, safe, uploads_dir, project_dir
    )
    use_rendered = bool(rendered_images)
    print(f'Rendered: {len(rendered_images)} action cards, {len(charcard_images)} char/rule cards',
          file=sys.stderr)

    # Build deck — use rendered card screenshots if available, else download raw art
    unique_entries = []
    for i, card in enumerate(cards):
        rendered = rendered_images.get(i)
        entry = build_card_entry(card, safe, uploads_dir, project_dir, i, rendered_image=rendered)
        unique_entries.append((card.get('count', 1), entry))

    deck_cards = []
    for count, entry in unique_entries:
        for _ in range(count):
            deck_cards.append(entry.copy())

    print(f'Cards: {len(deck_cards)} ({len(cards)} unique)', file=sys.stderr)

    # Character images:
    #   [0] Rendered character/ability card (charcard_0) or deck thumbnail fallback
    #   [1] Rendered rule card (charcard_1) if ruleCards exist, else patternUrl background
    #   [2] externalAvatar — character portrait token
    if charcard_images:
        # Use the rendered charcard screenshots (char card + rule card)
        char_images = charcard_images + ([token_rel] if token_rel else [])
    else:
        # Fallback: thumbnail + patternUrl + token
        hero_id = hero.get('id')
        thumb_rel = None
        if hero_id:
            thumb_url = f'{BASE_URL}/api/workers/preview/deck/thumbnail/{hero_id}'
            dest = os.path.join(uploads_dir, f'{safe}_card_preview.webp')
            if download_image(thumb_url, dest):
                thumb_rel = '/' + os.path.relpath(dest, project_dir).replace('\\', '/')
                print('Card preview (thumbnail fallback): downloaded', file=sys.stderr)

        pattern_rel = None
        pattern_url = hero.get('appearance', {}).get('patternUrl', '').strip()
        if pattern_url and rule_cards_raw:
            ext = os.path.splitext(pattern_url.split('?')[0])[1] or '.jpg'
            dest = os.path.join(uploads_dir, f'{safe}_rules_bg{ext}')
            if download_image(pattern_url, dest):
                pattern_rel = '/' + os.path.relpath(dest, project_dir).replace('\\', '/')
                print('Rules card background (fallback): downloaded', file=sys.stderr)

        char_images = [img for img in [thumb_rel, pattern_rel, token_rel] if img]

    # Sidekicks / extra tokens
    sidekick_speed = try_extract_sidekick_speed(rule_cards_raw)
    sidekicks_data = hero.get('sidekicks', [])
    extra_tokens = []
    extra_token_hp = 0

    for sk in sidekicks_data:
        sk_i18n_ru = sk.get('i18n', {}).get('ru', {})
        sk_name = (sk_i18n_ru.get('name') or sk.get('name', '')).strip()
        sk_url = ((sk.get('externalAvatar') or '').strip()
                  or (sk.get('avatar') or '').strip())
        sk_img_rel = None
        if sk_url:
            name_slug = safe_name(sk_name or 'sidekick')
            dest = os.path.join(uploads_dir, f'{safe}_sidekick_{name_slug}.png')
            if download_image(sk_url, dest):
                sk_img_rel = '/' + os.path.relpath(dest, project_dir).replace('\\', '/')
        sk_hp = sk.get('startHealth')
        if sk_hp is not None:
            extra_token_hp = int(sk_hp)
        extra_tokens.append({
            'name': sk_name,
            'image': sk_img_rel,
            'color': char_color,
            'hp': int(sk_hp) if sk_hp is not None else None,
            'attackType': sk.get('attack'),
            'count': int(sk.get('count', 1)),
            'speed': sidekick_speed,
        })

    character = {
        'name': display_name,
        'speed': move_val,
        'specialAbility': special_ability,
        'quote': quote,
        'ruleCards': rule_cards,
        'deck': {
            'backImage': cover_rel,
            'cards': deck_cards,
        },
        'mainToken': {
            'image': token_rel,
            'color': char_color,
            'hp': hp,
            'attackType': attack_type,
        },
        'extraTokens': extra_tokens,
        'extraTokenHP': extra_token_hp,
        'counters': [],
        'characterImages': char_images,
    }

    os.makedirs(chars_dir, exist_ok=True)
    char_file = os.path.join(chars_dir, f'{safe}.json')
    with open(char_file, 'w', encoding='utf-8') as f:
        json.dump(character, f, ensure_ascii=False, indent=2)

    missing = []
    if character['speed'] is None:
        missing.append('speed')
    if not cover_rel:
        missing.append('deck.backImage')
    if not token_rel:
        missing.append('mainToken.image')
    if character['mainToken']['color'] is None:
        missing.append('mainToken.color')
    if character['mainToken']['hp'] is None:
        missing.append('mainToken.hp')
    if character['mainToken']['attackType'] is None:
        missing.append('mainToken.attackType')

    result = {
        'success': True,
        'name': display_name,
        'characterPath': f'/heroes/characters/{safe}.json',
        'character': character,
        'summary': (
            f'Cards: {len(deck_cards)} ({len(cards)} unique). '
            f'Back: {"ok" if cover_rel else "MISSING"}. '
            f'Token: {"ok" if token_rel else "MISSING"}.'
        ),
        'missingFields': missing,
        'filesCopied': len([e['image'] for _, e in unique_entries if e.get('image')])
                       + (1 if cover_rel else 0)
                       + (1 if token_rel else 0)
                       + (1 if thumb_rel else 0)
                       + (1 if pattern_rel else 0)
                       + len([t for t in extra_tokens if t.get('image')]),
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
