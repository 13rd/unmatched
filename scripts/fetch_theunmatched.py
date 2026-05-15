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
import subprocess
import sys
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
    data_start = data_match.start()
    arr_start = js_obj.find('[', data_start)
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
const data = obj.data;
console.log(JSON.stringify(data));
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


def extract_card_name(card):
    desc = card.get('i18n', {}).get('ru', {}).get('description', {})
    content = desc.get('content', []) if isinstance(desc, dict) else []
    for node in content:
        if isinstance(node, dict) and node.get('type') == 'heading':
            heading_content = node.get('content', [])
            texts = [c.get('text', '') for c in heading_content if isinstance(c, dict)]
            name = ''.join(texts)
            if name:
                return name
    i18n = card.get('i18n', {})
    ru = i18n.get('ru', {})
    name = ru.get('bannerName', '') or ''
    if not name:
        name = card.get('bannerName', '') or ''
    if not name:
        name = str(card.get('id', ''))
    return name


def main():
    parser = argparse.ArgumentParser(description='Fetch character from the-unmatched.club')
    parser.add_argument('url_or_id', help='Hero URL or ID (e.g. галан.843)')
    parser.add_argument('--project-dir', default=PROJECT_DIR,
                        help='Project root (default: auto)')
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

    # Hero info
    chars = hero.get('characters', [])
    main_char = chars[0] if chars else {}
    char_i18n = main_char.get('i18n', {}).get('ru', {})
    display_name = char_i18n.get('name', '') or hero.get('title', '') or hero.get('key', 'unknown')
    hp = main_char.get('hp')
    if hp is not None:
        hp = int(hp)
    move_val = main_char.get('move')
    if move_val is not None:
        move_val = int(move_val)
    attack_type = main_char.get('attack')
    char_color = main_char.get('appearance', {}).get('borderColor')

    print(f'Character: {display_name}', file=sys.stderr)
    print(f'HP: {hp}, Move: {move_val}, Attack: {attack_type}', file=sys.stderr)
    print(f'Color: {char_color}', file=sys.stderr)
    print(f'Cards: {len(cards)} unique types', file=sys.stderr)

    safe = safe_name(display_name)

    # Token image - try externalAvatar, customImage, avatar, or first card art
    token_url = (main_char.get('externalAvatar') or ''
                 or main_char.get('customImage') or ''
                 or main_char.get('avatar') or '')
    if not token_url:
        token_url = hero.get('appearance', {}).get('patternUrl', '')

    token_rel = None
    if token_url:
        dest = os.path.join(uploads_dir, f'{safe}_token.png')
        if download_image(token_url, dest):
            token_rel = '/' + os.path.relpath(dest, project_dir).replace('\\', '/')
            print(f'Token: downloaded', file=sys.stderr)

    # Deck back image
    back_url = hero.get('cardsBack', '')
    cover_rel = None
    if back_url:
        dest = os.path.join(uploads_dir, f'{safe}_back.png')
        if download_image(back_url, dest):
            cover_rel = '/' + os.path.relpath(dest, project_dir).replace('\\', '/')
            print(f'Back: downloaded', file=sys.stderr)

    # Cards
    deck_cards = []
    for i, card in enumerate(cards):
        count = card.get('count', 1)
        card_name = extract_card_name(card)
        art_url = card.get('art', '')
        for copy_idx in range(count):
            img_rel = None
            if art_url:
                ext = os.path.splitext(art_url.split('?')[0])[1] or '.png'
                dest = os.path.join(uploads_dir, f'{safe}_card_{i}_{copy_idx}{ext}')
                if download_image(art_url, dest):
                    img_rel = '/' + os.path.relpath(dest, project_dir).replace('\\', '/')
            deck_cards.append({
                'image': img_rel,
                'text': card_name,
            })

    # Sidekicks
    sidekicks_data = hero.get('sidekicks', [])
    extra_tokens = []
    extra_token_hp = 0
    for sk in sidekicks_data:
        sk_url = sk.get('externalAvatar', '') or sk.get('customImage', '') or sk.get('avatar', '')
        sk_img_rel = None
        if sk_url:
            dest = os.path.join(uploads_dir, f'{safe}_sidekick_{safe_name(sk.get("name", "sidekick"))}.png')
            if download_image(sk_url, dest):
                sk_img_rel = '/' + os.path.relpath(dest, project_dir).replace('\\', '/')
        sk_hp = sk.get('hp')
        if sk_hp is not None:
            extra_token_hp = int(sk_hp)
        extra_tokens.append({
            'image': sk_img_rel,
            'color': None,
            'attackType': sk.get('attack'),
        })

    # Build character JSON matching the existing format
    character = {
        'name': display_name,
        'speed': move_val,
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
        'characterImages': [token_rel] if token_rel else [],
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
        'filesCopied': len([c for c in deck_cards if c['image']])
                       + (1 if cover_rel else 0)
                       + (1 if token_rel else 0),
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
