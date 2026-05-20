#!/usr/bin/env node
/**
 * Screenshot rendered card images from the-unmatched.club export page.
 *
 * Usage:
 *   node screenshot_cards.js <heroPageUrl> <outputDir>
 *
 * Output: JSON array to stdout:
 *   { cards: [{index, title, count, path}], charCards: [{index, title, path}] }
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = '/usr/bin/google-chrome';
const CARD_W = 750;
const CARD_H = 1050;

async function screenshotCards(heroPageUrl, outputDir) {
    const exportUrl = heroPageUrl.replace(/\/?$/, '') + '/export?type=tts';

    fs.mkdirSync(outputDir, { recursive: true });

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
        headless: true,
    });

    try {
        const page = await browser.newPage();

        // Wide viewport so the 7500px grids render properly
        await page.setViewport({ width: 800, height: 1100, deviceScaleFactor: 1 });

        process.stderr.write(`Loading: ${exportUrl}\n`);
        await page.goto(exportUrl, { waitUntil: 'networkidle2', timeout: 45000 });

        // Wait for SvelteKit to hydrate and render the TTS cards
        await page.waitForSelector('#ttsActionCards .card', { timeout: 20000 });
        process.stderr.write('Cards rendered\n');

        // Give images a moment to load
        await new Promise(r => setTimeout(r, 2000));

        const result = { cards: [], charCards: [] };

        // Screenshot action cards (unique card types, in order of cards array)
        const actionCards = await page.$$('#ttsActionCards .card');
        process.stderr.write(`Action cards: ${actionCards.length}\n`);

        for (let i = 0; i < actionCards.length; i++) {
            const el = actionCards[i];
            const title = await el.evaluate(n => n.getAttribute('data-title') || '');
            const count = parseInt(await el.evaluate(n => n.getAttribute('data-count') || '1'));

            const screenshotPath = path.join(outputDir, `card_${i}.png`);
            await el.screenshot({ path: screenshotPath });

            result.cards.push({ index: i, title, count, path: screenshotPath });
            process.stderr.write(`  card ${i}: "${title}" count=${count}\n`);
        }

        // Screenshot character + rule cards
        const charCards = await page.$$('#ttsCharacterCards .card');
        process.stderr.write(`Char cards: ${charCards.length}\n`);

        for (let i = 0; i < charCards.length; i++) {
            const el = charCards[i];
            const title = await el.evaluate(n =>
                n.getAttribute('data-title') || n.getAttribute('data-name') || ''
            );
            const screenshotPath = path.join(outputDir, `charcard_${i}.png`);
            await el.screenshot({ path: screenshotPath });
            result.charCards.push({ index: i, title, path: screenshotPath });
            process.stderr.write(`  charcard ${i}: "${title}"\n`);
        }

        return result;
    } finally {
        await browser.close();
    }
}

const heroUrl = process.argv[2];
const outputDir = process.argv[3];

if (!heroUrl || !outputDir) {
    process.stderr.write('Usage: node screenshot_cards.js <heroPageUrl> <outputDir>\n');
    process.exit(1);
}

screenshotCards(heroUrl, outputDir)
    .then(r => { process.stdout.write(JSON.stringify(r) + '\n'); })
    .catch(err => {
        process.stderr.write('Error: ' + err.message + '\n');
        process.exit(1);
    });
