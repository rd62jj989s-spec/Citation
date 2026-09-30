// Ende-zu-Ende-Test des Zitationsprüfers in Chromium.
// Die CDN-Bibliotheken werden aus node_modules ausgeliefert, damit der Test ohne Internet läuft.
// Aufruf: npm install && python3 make_samples.py && python3 embed_demo.py && node e2e.mjs [Ausgabeordner]

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out'));
fs.mkdirSync(OUT, { recursive: true });
const SAMPLES = path.join(HERE, 'samples');
const html = fs.readFileSync(path.join(HERE, '..', 'zitationspruefer.html'), 'utf8');
const page_html = '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>' + html + '</body></html>';

const LIBS = {
  'pdf.min.js': path.join(HERE, 'node_modules/pdfjs-dist/build/pdf.min.js'),
  'pdf.worker.min.js': path.join(HERE, 'node_modules/pdfjs-dist/build/pdf.worker.min.js'),
  'jszip.min.js': path.join(HERE, 'node_modules/jszip/dist/jszip.min.js'),
};

let failures = 0;
function expect(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FEHLER'} ${label}`);
  if (!ok) console.log('   erwartet:', JSON.stringify(expected), '\n   erhalten:', JSON.stringify(actual));
}

async function newPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 1400 } });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url === 'https://zp.test/') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: page_html });
    for (const [name, file] of Object.entries(LIBS)) {
      if (url.startsWith('https://cdnjs.cloudflare.com/') && url.endsWith('/' + name)) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    }
    if (url.startsWith('https://fonts.googleapis.com/')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (url.startsWith('blob:') || url.startsWith('data:')) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('https://zp.test/');
  return { page, context, errors };
}

async function waitReady(page, minCards = 1) {
  await page.waitForFunction(n => document.querySelector('#app').dataset.busy === 'false' && document.querySelectorAll('#results li.card').length >= n, minCards, { timeout: 60000 });
}

async function cards(page) {
  return page.$$eval('#results li.card', els => els.map(el => ({
    status: el.querySelector('.status').lastChild.textContent.trim(),
    beleg: el.querySelector('dd').textContent,
    text: el.querySelector('.kv').innerText,
  })));
}

async function showPages(page, index, file) {
  const card = page.locator('#results li.card').nth(index);
  await card.locator('button', { hasText: /anzeigen/ }).click();
  await card.locator('.pages img').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(200);
  await card.screenshot({ path: path.join(OUT, file) });
}

const browser = await chromium.launch();

// 1. Beispiel beim ersten Öffnen
{
  const { page, context, errors } = await newPage(browser);
  await waitReady(page, 8);
  const cs = await cards(page);
  cs.forEach((c, i) => console.log(`  [${i}] ${c.status} | ${c.beleg}`));
  expect('Beispiel: Status der Karten', cs.map(c => c.status), [
    'Bestätigt', 'Bestätigt', 'Seitenangabe prüfen', 'Wortlaut weicht ab', 'Seitenangabe prüfen',
    'Sinngemäß, bitte selbst prüfen', 'Nicht gefunden', 'Keine PDF zugeordnet',
  ]);
  expect('Beispiel: falsche Seite erkannt', /S\. 158 \(PDF-Seite 3\)/.test(cs[2].text), true);
  expect('Beispiel: Abweichung benannt', /glaubhaften.*glaubwürdigen/s.test(cs[3].text), true);
  expect('Beispiel: Seitenwechsel erkannt', /S\. 159–160/.test(cs[4].text), true);
  await page.screenshot({ path: path.join(OUT, 'beispiel_seite.png'), fullPage: true });
  await showPages(page, 0, 'beispiel_bestaetigt.png');
  await showPages(page, 4, 'beispiel_seitenwechsel.png');
  await showPages(page, 5, 'beispiel_sinngemaess.png');
  expect('Beispiel: keine Konsolenfehler', errors, []);
  await context.close();
}

// 2. Word-Datei, zunächst nur eine Quelle, die zweite kommt über „Aktualisieren“ auf der Karte
{
  const { page, context, errors } = await newPage(browser);
  await waitReady(page, 8);
  await page.setInputFiles('#thesis-file', path.join(SAMPLES, 'masterarbeit_beispiel.docx'));
  await page.setInputFiles('#source-files', [path.join(SAMPLES, 'Muster_2021_Organisationskommunikation.pdf')]);
  await page.waitForFunction(() => document.querySelector('#source-status').textContent.includes('1 Quelle geladen'), null, { timeout: 60000 });
  await waitReady(page, 10);
  const before = await cards(page);
  expect('Karte: vorher ohne PDF', before[11].status, 'Keine PDF zugeordnet');
  const card11 = page.locator('#results li.card').nth(11);
  expect('Karte: Aktualisieren-Knopf vorhanden', await card11.locator('label.btn', { hasText: 'Aktualisieren' }).count(), 1);
  await card11.locator('input[type=file]').setInputFiles(path.join(SAMPLES, 'Beispiel_2019_Digitale_Oeffentlichkeiten.pdf'));
  await page.waitForFunction(() => /Aktualisiert um .*Beispiel \(2019\)/.test(document.querySelector('#update-status').textContent), null, { timeout: 60000 });
  await waitReady(page, 10);
  console.log('  ' + await page.$eval('#update-status', el => el.textContent));
  const cs = await cards(page);
  expect('Karte: danach bestätigt und gekennzeichnet', [cs[11].status, await page.locator('#results li.card').nth(11).innerText().then(t => t.includes('Gerade aktualisiert'))], ['Bestätigt', true]);
  cs.forEach((c, i) => console.log(`  [${i}] ${c.status} | ${c.beleg}`));
  const expected = [
    'Bestätigt', 'Bestätigt', 'Bestätigt', 'Seitenangabe prüfen', 'Wortlaut weicht ab', 'Seitenangabe prüfen', 'Bestätigt',
    'Sinngemäß, bitte selbst prüfen', 'Nicht gefunden', 'Sinngemäß, bitte selbst prüfen', 'Sinngemäß, bitte selbst prüfen',
    'Bestätigt', 'Bestätigt', 'Sinngemäß, bitte selbst prüfen', 'Keine PDF zugeordnet', 'Sinngemäß ohne Seitenangabe',
  ];
  expect('Word: Status der Karten', cs.map(c => c.status), expected);
  expect('Word: Blockzitat erkannt', cs.some(c => /^Blockzitat/m.test(c.text)), true);
  const mapping = await page.$$eval('#source-body tr', rows => rows.map(r => r.children[1].innerText.split('\n')[0]));
  expect('Word: Seitenzählung erkannt', mapping, ['S. 157 ist PDF-Seite 2', 'S. 41 ist PDF-Seite 1']);
  const biblio = await page.$eval('#biblio', el => el.innerText);
  expect('Word: fehlender Eintrag gemeldet', /Nichtda \(2020\)/.test(biblio), true);
  expect('Word: unzitierter Eintrag gemeldet', /Ungenutzt, U\. \(2018\)/.test(biblio), true);
  expect('Word: Komma-Hinweis', cs.some(c => /Komma/.test(c.text)), true);
  expect('Word: f.-Hinweis', cs.some(c => /statt „f\.“/.test(c.text)), true);
  await showPages(page, 2, 'word_blockzitat.png');
  await showPages(page, 12, 'word_artikel.png');
  await page.screenshot({ path: path.join(OUT, 'word_seite.png'), fullPage: true });
  expect('Word: keine Konsolenfehler', errors, []);

  // Korrigierte Fassung über den Aktualisieren-Knopf im Ergebnis
  await page.setInputFiles('#update-file', path.join(SAMPLES, 'masterarbeit_beispiel_v2.docx'));
  await page.waitForFunction(() => /Aktualisiert mit masterarbeit_beispiel_v2/.test(document.querySelector('#update-status').textContent), null, { timeout: 60000 });
  const upd = await page.$eval('#update-status', el => el.textContent);
  console.log('  ' + upd);
  expect('Aktualisieren: Vergleich vorher und nachher', /Probleme vorher 4, jetzt 1\. Bestätigt vorher 6, jetzt 9\./.test(upd), true);
  const cv2 = await cards(page);
  expect('Aktualisieren: korrigierte Belege bestätigt', [cv2[3].status, cv2[4].status, cv2[5].status], ['Bestätigt', 'Bestätigt', 'Bestätigt']);

  // Quellen bleiben nach dem Neuladen erhalten
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#source-status').textContent.includes('gespeicherte Quellen geladen'), null, { timeout: 60000 });
  const names = await page.$$eval('#source-body tr', rows => rows.map(r => r.children[0].innerText.split('\n')[0]));
  expect('Neuladen: gespeicherte Quellen', names, ['Muster_2021_Organisationskommunikation.pdf', 'Beispiel_2019_Digitale_Oeffentlichkeiten.pdf']);
  await page.setInputFiles('#thesis-file', path.join(SAMPLES, 'masterarbeit_beispiel.pdf'));
  await waitReady(page, 10);
  const cp = await cards(page);
  cp.forEach((c, i) => console.log(`  [${i}] ${c.status} | ${c.beleg}`));
  expect('PDF-Arbeit: Status der Karten', cp.map(c => c.status), expected);
  await showPages(page, 11, 'pdfarbeit_gespeicherte_quelle.png');
  expect('PDF-Arbeit: keine Konsolenfehler', errors, []);
  await context.close();
}

// 3. Handybreite
{
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url === 'https://zp.test/') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: page_html });
    for (const [name, file] of Object.entries(LIBS)) if (url.endsWith('/' + name)) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    if (url.startsWith('https://fonts.googleapis.com/')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto('https://zp.test/');
  await waitReady(page, 8);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect('Handy: kein seitliches Scrollen', overflow <= 0, true);
  await page.screenshot({ path: path.join(OUT, 'handy.png'), fullPage: true });
  await context.close();
}

await browser.close();
console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.');
process.exit(failures ? 1 : 0);
