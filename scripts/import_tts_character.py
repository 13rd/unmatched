#!/usr/bin/env python3
"""
Import TTS (Tabletop Simulator) character deck to Unmatched JS Table format.

Usage:
    python3 scripts/import_tts_character.py --zip archive.zip [--name "Name"]

    python3 scripts/import_tts_character.py \
        --json deck.json \
        --images ./images/ \
        --cover cover.png --token token.png \
        [--name "Name"]

Output: JSON to stdout, character file to heroes/characters/
"""

import json
import os
import re
import shutil
import sys
import tempfile
import zipfile
import argparse


def find_tts_json(dir_path):
    for root, _dirs, files in os.walk(dir_path):
        for f in files:
            if not f.endswith('.json'):
                continue
            try:
                with open(os.path.join(root, f)) as fh:
                    data = json.load(fh)
                if 'ObjectStates' in data and len(data['ObjectStates']) > 0:
                    if 'CustomDeck' in data['ObjectStates'][0]:
                        return os.path.join(root, f)
            except Exception:
                pass
    return None


def parse_tts_json(json_path):
    with open(json_path) as f:
        data = json.load(f)

    obj = data['ObjectStates'][0]
    custom_deck = obj['CustomDeck']
    contained = obj['ContainedObjects']
    deck_number = int(list(custom_deck.keys())[0])

    card_info = {}
    for c in contained:
        cid = c['CardID']
        nick = c.get('Nickname', '')
        if cid not in card_info:
            m = re.search(r'(\d+)', nick)
            num = m.group(1) if m else str(cid % 100)
            card_info[cid] = {'number': num, 'count': 0}
        card_info[cid]['count'] += 1

    name = obj.get('Nickname', '')

    return {
        'card_info': card_info,
        'name': name,
        'deck_number': deck_number,
        'total_cards': len(contained),
    }


def match_images(image_dir, card_info, cover_filename=None, token_filename=None):
    files = sorted(
        os.path.join(root, f)
        for root, _dirs, fnames in os.walk(image_dir)
        for f in fnames
        if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))
    )
    files = [os.path.relpath(f, image_dir) for f in files]

    num_to_cid = {info['number']: cid for cid, info in card_info.items()}

    matches = {}
    cover_path = None
    token_path = None
    remaining = []

    for f in files:
        fpath = os.path.join(image_dir, f)
        fl = f.lower()

        if cover_filename and f == cover_filename:
            cover_path = fpath
            continue
        if token_filename and f == token_filename:
            token_path = fpath
            continue

        if any(kw in fl for kw in ('cover', 'рубашк', 'back')):
            cover_path = fpath
            continue
        if any(kw in fl for kw in ('hero', 'token', 'new-hero', 'главн', 'токен', 'герой', 'main')):
            token_path = fpath
            continue

        nums = re.findall(r'(\d+)', f)
        matched = False
        for num in nums:
            if num in num_to_cid:
                cid = num_to_cid[num]
                if cid not in matches:
                    matches[cid] = fpath
                    matched = True
                    break
        if not matched:
            remaining.append(fpath)

    if not cover_path and remaining:
        cover_path = remaining.pop(0)
    if not token_path and remaining:
        token_path = remaining.pop(0)

    return matches, cover_path, token_path


def copy_file(src, dest_dir, stem):
    os.makedirs(dest_dir, exist_ok=True)
    ext = os.path.splitext(src)[1]
    dest = os.path.join(dest_dir, stem + ext)
    shutil.copy2(src, dest)
    return dest


def main():
    parser = argparse.ArgumentParser(description='Import TTS character')
    parser.add_argument('--json', help='path to TTS JSON file')
    parser.add_argument('--images', help='directory with card images')
    parser.add_argument('--cover', help='cover/back filename inside images dir')
    parser.add_argument('--token', help='token filename inside images dir')
    parser.add_argument('--name', help='character name (overrides auto-detect)')
    parser.add_argument('--zip', help='ZIP archive with JSON + images')
    parser.add_argument('--project-dir', default=os.getcwd(),
                        help='project root (default: cwd)')

    args = parser.parse_args()
    project_dir = os.path.abspath(args.project_dir)

    temp_dir = None
    if args.zip:
        temp_dir = tempfile.mkdtemp()
        with zipfile.ZipFile(args.zip) as zf:
            zf.extractall(temp_dir)
        json_path = find_tts_json(temp_dir)
        if not json_path:
            print(json.dumps(
                {'success': False, 'error': 'TTS JSON не найден в архиве'}))
            sys.exit(1)
        image_dir = temp_dir
        cover_arg = args.cover
        token_arg = args.token
    else:
        if not args.json:
            print(json.dumps(
                {'success': False, 'error': 'Укажите --json или --zip'}))
            sys.exit(1)
        json_path = os.path.abspath(args.json)
        image_dir = os.path.abspath(args.images) if args.images else os.path.dirname(json_path)
        cover_arg = args.cover
        token_arg = args.token

    deck_data = parse_tts_json(json_path)
    char_name = args.name or deck_data['name']
    if not char_name:
        print(json.dumps(
            {'success': False, 'error': 'Не удалось определить имя персонажа'}))
        sys.exit(1)

    print(f'Parsed: {json_path}', file=sys.stderr)
    print(f'Name: {char_name}', file=sys.stderr)
    print(f'Unique card types: {len(deck_data["card_info"])}, '
          f'Total: {deck_data["total_cards"]}', file=sys.stderr)

    matches, cover_path, token_path = match_images(
        image_dir, deck_data['card_info'], cover_arg, token_arg)

    found = len(matches)
    expected = len(deck_data['card_info'])
    print(f'Card images matched: {found}/{expected}', file=sys.stderr)
    print(f'Cover: {"found" if cover_path else "NOT FOUND"}', file=sys.stderr)
    print(f'Token: {"found" if token_path else "NOT FOUND"}', file=sys.stderr)

    uploads_dir = os.path.join(project_dir, 'uploads')

    cover_rel = None
    if cover_path:
        dst = copy_file(cover_path, uploads_dir, f'{char_name}_back')
        cover_rel = '/' + os.path.relpath(dst, project_dir).replace('\\', '/')

    token_rel = None
    if token_path:
        dst = copy_file(token_path, uploads_dir, f'{char_name}_token')
        token_rel = '/' + os.path.relpath(dst, project_dir).replace('\\', '/')

    with open(json_path) as f:
        raw = json.load(f)
    contained = raw['ObjectStates'][0]['ContainedObjects']

    cards = []
    seen = {}
    for c in contained:
        cid = c['CardID']
        num = deck_data['card_info'][cid]['number']
        copy_index = seen.get(num, 0)
        seen[num] = copy_index + 1

        fpath = matches.get(cid)
        if fpath:
            dst = copy_file(fpath, uploads_dir,
                            f'{char_name}_card_{num}_{copy_index}')
            rel = '/' + os.path.relpath(dst, project_dir).replace('\\', '/')
        else:
            rel = None

        cards.append({
            'image': rel,
            'text': f'{char_name}_{num}',
        })

    safe_name = char_name.lower().replace(' ', '_').replace('-', '_')
    character = {
        'name': char_name,
        'speed': None,
        'deck': {
            'backImage': cover_rel,
            'cards': cards,
        },
        'mainToken': {
            'image': token_rel,
            'color': None,
            'hp': None,
            'attackType': None,
        },
        'extraTokens': [],
        'extraTokenHP': 0,
        'counters': [],
        'characterImages': [token_rel] if token_rel else [],
    }

    chars_dir = os.path.join(project_dir, 'heroes', 'characters')
    os.makedirs(chars_dir, exist_ok=True)
    char_file = os.path.join(chars_dir, f'{safe_name}.json')
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
    missing.append('deck.cards[*].text (названия карт)')

    summary = (
        f'Найдено {found}/{expected} уникальных карт ({len(cards)} копий). '
        f'Скопировано файлов: {sum(1 for c in cards if c["image"])}'
    )
    if cover_rel:
        summary += ', рубашка ✓'
    else:
        summary += ', рубашка ✗'
    if token_rel:
        summary += ', токен ✓'
    else:
        summary += ', токен ✗'

    result = {
        'success': True,
        'name': char_name,
        'characterPath': f'/heroes/characters/{safe_name}.json',
        'character': character,
        'summary': summary,
        'missingFields': missing,
        'filesCopied': sum(1 for c in cards if c['image'])
                         + (1 if cover_rel else 0)
                         + (1 if token_rel else 0),
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))

    if temp_dir:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == '__main__':
    main()
