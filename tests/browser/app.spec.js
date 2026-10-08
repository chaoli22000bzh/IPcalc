import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.__appErrors = errors;
  await page.goto('./');
});

test.afterEach(async ({ page }) => {
  expect(page.__appErrors).toEqual([]);
});

async function subdivide(page, { address = '192.168.10.75/24', method = 'count', count = '10', hosts = '30' } = {}) {
  await page.getByLabel('Adresse IPv4').fill(address);
  await page.getByLabel('Sous-réseaux', { exact: true }).check();
  await page.getByLabel('Méthode de découpage FLSM').selectOption(method);
  if (method !== 'hosts') await page.getByLabel('Sous-réseaux demandés', { exact: true }).fill(count);
  if (method !== 'count') await page.getByLabel('Hôtes utilisables minimum').fill(hosts);
  await page.getByRole('button', { name: 'Calculer le réseau' }).click();
}

test('réseau simple, cinq champs exacts et normalisation de l’hôte', async ({ page }) => {
  const summary = page.locator('#network-result');
  await expect(summary.locator('dd')).toHaveText(['192.168.10.64', '255.255.255.192', '/26', '192.168.10.127', '62']);
  await expect(summary).toContainText('192.168.10.75/26 appartient au réseau 192.168.10.64/26');
  await expect(page.locator('.binary')).toHaveCount(0);
  await expect(page.locator('#subnet-result')).toBeHidden();
});

test('adresse et masque invalides : erreur annoncée, champ ciblé, résultats masqués', async ({ page }) => {
  await page.getByLabel('Adresse IPv4').fill('256.1.2.3/24');
  await page.getByRole('button', { name: 'Calculer le réseau' }).click();
  await expect(page.getByRole('alert')).toContainText('0 et 255');
  await expect(page.getByLabel('Adresse IPv4')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#results')).toBeHidden();
  await page.getByLabel('Adresse IPv4').fill('192.168.1.1');
  await page.getByLabel('Masque ou préfixe').fill('255.0.255.0');
  await page.getByRole('button', { name: 'Calculer le réseau' }).click();
  await expect(page.getByRole('alert')).toContainText('contigu');
  await page.getByLabel('Masque ou préfixe').fill('255.255.255.0');
  await page.getByRole('button', { name: 'Calculer le réseau' }).click();
  await expect(page.locator('#network-result dd').first()).toHaveText('192.168.1.0');
});

test('dix sous-réseaux demandés : règle papier exacte et capacité distincte', async ({ page }) => {
  await subdivide(page);
  await expect(page.locator('#subnet-result h3')).toHaveText('10 sous-réseaux demandés');
  await expect(page.locator('#subnet-result')).toContainText('Capacité totale 16');
  const numbers = await page.locator('#subnet-result tr[data-subnet-number]').evaluateAll(rows => rows.map(row => row.dataset.subnetNumber));
  expect(numbers).toEqual(['1', '2', '3', '8', '9', '10']);
  await expect(page.locator('.ellipsis-row')).toContainText('4 sous-réseaux intermédiaires');
  await page.locator('#middle-details > summary').click();
  await expect(page.locator('#middle-details tr[data-subnet-number]')).toHaveCount(4);
  await expect(page.locator('#middle-details tr[data-subnet-number]').first()).toHaveAttribute('data-subnet-number', '4');
  await page.locator('#extra-details > summary').click();
  await expect(page.locator('#extra-details tr[data-subnet-number]').first()).toHaveAttribute('data-subnet-number', '11');
  await expect(page.locator('#export-scope option').first()).toHaveText('Sous-réseaux visibles (16)');
});

test('méthodes hôtes et combinée, puis contrainte impossible', async ({ page }) => {
  await subdivide(page, { method: 'hosts', hosts: '30' });
  await expect(page.locator('#subnet-result h3')).toHaveText('8 sous-réseaux possibles');
  await expect(page.locator('#subnet-result')).toContainText('Préfixe /27');
  await expect(page.locator('#extra-details')).toHaveCount(0);
  await subdivide(page, { method: 'combined', count: '3', hosts: '50' });
  await expect(page.locator('#subnet-result h3')).toHaveText('3 sous-réseaux demandés');
  await expect(page.locator('#subnet-result tr[data-subnet-number]')).toHaveCount(3);
  await subdivide(page, { method: 'combined', count: '5', hosts: '50' });
  await expect(page.getByRole('alert')).toContainText('réseau initial plus grand');
  await expect(page.getByRole('alert')).toContainText('moins de sous-réseaux');
});

test('grand /0 : six lignes, pagination bornée et export protégé', async ({ page }) => {
  await subdivide(page, { address: '0.0.0.0/0', method: 'hosts', hosts: '2' });
  await expect(page.locator('#subnet-result tr[data-subnet-number]')).toHaveCount(6);
  await expect(page.locator('#subnet-result tr[data-subnet-number]').last()).toContainText('255.255.255.254');
  await page.locator('#middle-details > summary').click();
  await expect(page.locator('#middle-details tr[data-subnet-number]')).toHaveCount(50);
  await page.getByRole('button', { name: 'Suivants : sous-réseaux intermédiaires' }).click();
  await expect(page.locator('#middle-details tr[data-subnet-number]').first()).toHaveAttribute('data-subnet-number', '54');
  await page.getByLabel('Périmètre', { exact: true }).selectOption('all');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  await expect(page.locator('#export-feedback')).toContainText('La limite est de');
  await expect(page.locator('#export-feedback')).toHaveAttribute('data-error', 'true');
});

test('binaire facultatif : 32 bits et séparation réseau / hôte', async ({ page }) => {
  await page.getByLabel('Afficher le binaire').check();
  const address = page.locator('#network-result .binary').first();
  await expect(address.locator('.network-bit')).toHaveCount(26);
  await expect(address.locator('.host-bit')).toHaveCount(6);
  await expect(address.locator('.binary-octet')).toHaveCount(4);
  await page.getByLabel('Afficher le binaire').uncheck();
  await expect(page.locator('.binary')).toHaveCount(0);
});

test('export réel : CSV demandés, puis ensemble', async ({ page }) => {
  await subdivide(page);
  for (const [scope, rows] of [['requested', 10], ['all', 16], ['visible', 6]]) {
    await page.getByLabel('Périmètre', { exact: true }).selectOption(scope);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloading;
    const bytes = await readFile(await download.path());
    expect([...bytes.subarray(0, 3)]).toEqual([239, 187, 191]);
    const csv = bytes.toString('utf8');
    expect(csv.trim().split('\r\n')).toHaveLength(rows + 2);
    expect(csv).toContain('"Adresse réseau";"Masque décimal";"Préfixe CIDR";"Broadcast";"Hôtes utilisables"');
    expect(download.suggestedFilename()).toBe(`IPcalc-192.168.10.0-24-${scope}.csv`);
    expect(csv).not.toMatch(/Première|Dernière/);
  }
});

test('copie et protection des résultats devenus obsolètes', async ({ page }) => {
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedResult = text; } } }));
  await page.getByRole('button', { name: 'Copier', exact: true }).click();
  await expect(page.locator('#export-feedback')).toContainText('Copié');
  expect(await page.evaluate(() => window.copiedResult)).toContain('Adresse réseau : 192.168.10.64');
  await page.getByLabel('Adresse IPv4').fill('10.1.2.3/8');
  await expect(page.locator('#stale-notice')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copier', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  await page.getByRole('button', { name: 'Calculer le réseau' }).click();
  await expect(page.getByRole('button', { name: 'Copier', exact: true })).toBeEnabled();
});

test('première visite en ligne puis nouveau lancement hors connexion', async ({ page, context }) => {
  await expect(page.locator('#connection-label')).toHaveText('Prêt hors connexion');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  const manifest = await page.evaluate(async () => {
    const response = await fetch('./manifest.webmanifest');
    return response.json();
  });
  expect(manifest.display).toBe('standalone');
  expect(manifest.scope).toBe('./');
  expect(manifest.icons.filter(icon => icon.type === 'image/png')).toHaveLength(3);
  await context.setOffline(true);
  const offline = await context.newPage();
  // Chromium récent sépare le blocage des requêtes et l’état réseau du
  // renderer. Les deux sont coupés, sans simuler navigator.onLine en JS.
  const session = await context.newCDPSession(offline);
  await session.send('Network.enable');
  const errors = [];
  offline.on('pageerror', error => errors.push(error.message));
  await offline.goto('./');
  // La nouvelle navigation peut réinitialiser l’indicateur du renderer,
  // tandis que le blocage réel des requêtes est déjà actif dans le contexte.
  await session.send('Network.overrideNetworkState', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await expect(offline.locator('#connection-label')).toHaveText('Hors connexion');
  expect(await offline.evaluate(async () => {
    try { await fetch('./offline-network-probe'); return false; } catch { return true; }
  })).toBe(true);
  await offline.getByLabel('Adresse IPv4').fill('10.0.0.1/31');
  await offline.getByRole('button', { name: 'Calculer le réseau' }).click();
  await expect(offline.locator('#network-result dd')).toHaveText(['10.0.0.0', '255.255.255.254', '/31', 'Sans broadcast', '2']);
  await subdivide(offline, { method: 'combined', count: '3', hosts: '50' });
  await expect(offline.locator('#subnet-result h3')).toHaveText('3 sous-réseaux demandés');
  expect(errors).toEqual([]);
  await offline.close();
});

test('ressources locales, thème automatique, portrait / paysage sans débordement', async ({ page }) => {
  const external = [];
  page.on('request', request => {
    if (new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url());
  });
  await page.reload();
  await subdivide(page);
  await page.getByLabel('Afficher le binaire').check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(21, 29, 27)');
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(245, 246, 242)');
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(external).toEqual([]);
});
