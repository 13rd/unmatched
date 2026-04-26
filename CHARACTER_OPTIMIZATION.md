# Оптимизация размера файлов персонажей

## Проблема
Файлы персонажей с изображениями в формате base64 получаются очень большими (несколько мегабайт), что приводит к медленной загрузке.

## Решение

### Вариант 1: Использование внешних файлов изображений (Рекомендуется)

Вместо встраивания изображений в JSON, храните их как отдельные файлы:

**Структура:**
```
heroes/characters/
├── my_character.json
└── my_character_assets/
    ├── main_token.png
    ├── extra_token_1.png
    ├── extra_token_2.png
    ├── card_back.png
    ├── card_1.png
    ├── card_2.png
    └── ... (до card_30.png)
```

**Формат JSON:**
```json
{
  "name": "Мой Персонаж",
  "mainToken": {
    "image": "/heroes/characters/my_character_assets/main_token.png",
    "color": "#e53e3e",
    "hp": 14
  },
  "deck": {
    "backImage": "/heroes/characters/my_character_assets/card_back.png",
    "cards": [
      {"image": "/heroes/characters/my_character_assets/card_1.png", "text": "Карта 1"},
      ...
    ]
  }
}
```

**Преимущества:**
- Размер JSON файла: ~5-10 KB вместо 5-10 MB
- Быстрая загрузка списка персонажей
- Изображения загружаются по требованию
- Легко заменить отдельные изображения

### Вариант 2: Оптимизация base64 изображений

Если вы хотите использовать base64:

1. **Уменьшите разрешение изображений:**
   - Токены: 100x100 px
   - Карты: 200x280 px

2. **Используйте сжатие:**
   - JPEG с качеством 70-80% для фотографий
   - PNG с оптимизацией для графики
   - WebP для лучшего сжатия

3. **Используйте SVG где возможно:**
   - Для простых иконок и символов
   - SVG можно встроить напрямую без base64

## Как конвертировать существующий персонаж

### Скрипт для извлечения изображений из JSON:

```javascript
// extract_images.js
const fs = require('fs');
const path = require('path');

const characterFile = 'heroes/characters/my_character.json';
const character = JSON.parse(fs.readFileSync(characterFile, 'utf8'));
const assetsDir = characterFile.replace('.json', '_assets');

// Создаем папку для ресурсов
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Функция для сохранения base64 изображения
function saveBase64Image(base64Data, filename) {
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    const buffer = Buffer.from(matches[2], 'base64');
    fs.writeFileSync(path.join(assetsDir, filename), buffer);
    return `/${assetsDir}/${filename}`;
  }
  return base64Data;
}

// Сохраняем главный токен
if (character.mainToken.image.startsWith('data:')) {
  character.mainToken.image = saveBase64Image(
    character.mainToken.image, 
    'main_token.png'
  );
}

// Сохраняем дополнительные токены
character.extraTokens.forEach((token, i) => {
  if (token.image.startsWith('data:')) {
    token.image = saveBase64Image(
      token.image, 
      `extra_token_${i + 1}.png`
    );
  }
});

// Сохраняем рубашку колоды
if (character.deck.backImage.startsWith('data:')) {
  character.deck.backImage = saveBase64Image(
    character.deck.backImage, 
    'card_back.png'
  );
}

// Сохраняем карты
character.deck.cards.forEach((card, i) => {
  if (card.image && card.image.startsWith('data:')) {
    card.image = saveBase64Image(
      card.image, 
      `card_${i + 1}.png`
    );
  }
});

// Сохраняем обновленный JSON
fs.writeFileSync(characterFile, JSON.stringify(character, null, 2));
console.log('Изображения извлечены в:', assetsDir);
```

**Использование:**
```bash
node extract_images.js
```

## Рекомендации

1. **Для новых персонажей:** Сразу создавайте папку с ресурсами и используйте ссылки
2. **Размер изображений:** Не превышайте 200 KB на изображение
3. **Формат:** PNG для токенов, JPEG для карт с фотографиями
4. **Тестирование:** Проверяйте размер JSON файла (должен быть < 50 KB)

## Пример тестового персонажа

Смотрите `heroes/characters/test_character.json` - пример оптимизированного персонажа с внешними SVG файлами.
