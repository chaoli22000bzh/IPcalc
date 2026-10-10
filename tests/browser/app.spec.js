import { test, expect } from '@playwright/test';

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
  await page.getByLabel('Adresse IP').fill(address);
  await page.getByRole('radio', { name: 'FLSM', exact: true }).check();
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
  await page.getByLabel('Adresse IP').fill('256.1.2.3/24');
  await page.getByRole('button', { name: 'Calculer le réseau' }).click();
  await expect(page.getByRole('alert')).toContainText('0 et 255');
  await expect(page.getByLabel('Adresse IP')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#results')).toBeHidden();
  await page.getByLabel('Adresse IP').fill('192.168.1.1');
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
  expect(numbers).toEqual(['0', '1', '2', '7', '8', '9']);
  await expect(page.locator('.ellipsis-row')).toContainText('4 sous-réseaux intermédiaires');
  await page.locator('#middle-details > summary').click();
  await expect(page.locator('#middle-details tr[data-subnet-number]')).toHaveCount(4);
  await expect(page.locator('#middle-details tr[data-subnet-number]').first()).toHaveAttribute('data-subnet-number', '3');
  await page.locator('#extra-details > summary').click();
  await expect(page.locator('#extra-details tr[data-subnet-number]').first()).toHaveAttribute('data-subnet-number', '10');
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

test('grand /0 : six lignes et pagination bornée', async ({ page }) => {
  await subdivide(page, { address: '0.0.0.0/0', method: 'hosts', hosts: '2' });
  await expect(page.locator('#subnet-result tr[data-subnet-number]')).toHaveCount(6);
  await expect(page.locator('#subnet-result tr[data-subnet-number]').last()).toContainText('255.255.255.254');
  await page.locator('#middle-details > summary').click();
  await expect(page.locator('#middle-details tr[data-subnet-number]')).toHaveCount(50);
  await page.getByRole('button', { name: 'Suivants : sous-réseaux intermédiaires' }).click();
  await expect(page.locator('#middle-details tr[data-subnet-number]').first()).toHaveAttribute('data-subnet-number', '53');

});

test('la case binaire a disparu de l’interface', async ({ page }) => {
  await expect(page.locator('#show-binary, .binary-toggle')).toHaveCount(0);
  await expect(page.locator('.binary')).toHaveCount(0);
});

test('protection des résultats devenus obsolètes sans ancienne interface d’export', async ({ page }) => {
  await expect(page.locator('#copy-results, #export-csv, #export-scope, .export-panel')).toHaveCount(0);
  await page.getByLabel('Adresse IP', { exact: true }).fill('10.1.2.3/8');
  await expect(page.locator('#stale-notice')).toBeVisible();
  await expect(page.locator('#network-result')).toBeEmpty();
  await expect(page.locator('#subnet-result')).toBeEmpty();
  await expect(page.locator('#network-result')).toBeEmpty();
  await page.getByRole('button', { name: 'Calculer le réseau' }).click();
  await expect(page.locator('#network-result')).toContainText('10.0.0.0');
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
  await offline.getByLabel('Adresse IP').fill('10.0.0.1/31');
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(21, 29, 27)');
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(245, 246, 242)');
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(external).toEqual([]);
});


test('modes disponibles, emplacements futurs et disposition verticale', async ({ page }) => {
  await expect(page.getByRole('radio', { name: 'VLSM', exact: true })).toBeEnabled();
  await expect(page.locator('#protocol option[value="ipv6"]')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Imprimer — à venir' })).toBeDisabled();
  await expect(page.locator('.intro')).toHaveCount(0);
  const input = await page.locator('.input-panel').boundingBox();
  const results = await page.locator('#results').boundingBox();
  expect(results.y).toBeGreaterThanOrEqual(input.y + input.height);
  expect(Math.abs(results.width - input.width)).toBeLessThan(2);
  await subdivide(page);
  await page.getByRole('radio', { name: 'Aucun découpage', exact: true }).check();
  await expect(page.locator('#subnet-settings')).toBeHidden();
  await expect(page.locator('#network-result')).toBeEmpty();
  await expect(page.locator('#subnet-result')).toBeEmpty();
  await page.getByRole('button', { name: 'Calculer le réseau' }).click();
  await expect(page.locator('#network-result dd')).toHaveCount(5);
  await expect(page.locator('#subnet-result')).toBeHidden();
});

test('chaque paramètre invalide immédiatement le résultat', async ({ page }) => {
  for (const parameter of ['address', 'mask', 'method', 'count', 'hosts']) {
    await subdivide(page, { method: 'combined', count: '3', hosts: '50' });
    if (parameter === 'method') await page.locator('#method').selectOption('hosts');
    else await page.locator(`#${parameter}`).fill({ address: '10.0.0.1/24', mask: '/24', count: '2', hosts: '20' }[parameter]);
    await expect(page.locator('#network-result')).toBeEmpty();
    await expect(page.locator('#subnet-result')).toBeEmpty();
    await expect(page.locator('#result-announcement')).toBeEmpty();
    await page.locator('#mask').fill('');
  }
});

test('modifier un calcul avec pagination ouverte ne conserve aucun sous-réseau', async ({ page }) => {
  await subdivide(page);
  await page.locator('#middle-details > summary').click();
  await page.locator('#extra-details > summary').click();
  await page.getByLabel('Adresse IP').fill('10.0.0.0/16');
  await expect(page.locator('#subnet-result')).toBeEmpty();
  await expect(page.locator('#network-result')).toBeEmpty();
  await page.getByRole('button', { name: 'Calculer le réseau' }).click();
  await expect(page.locator('#network-result')).toContainText('10.0.0.0');
  await expect(page.locator('#middle-details')).not.toHaveAttribute('open');
  await expect(page.locator('#extra-details')).not.toHaveAttribute('open');
});

test('bouton au-dessus de l’adresse, en-têtes alignés et navigation clavier', async ({ page }) => {
  const button = page.getByRole('button', { name: 'Calculer le réseau' });
  const address = page.getByLabel('Adresse IP');
  const initialButton = await button.boundingBox();
  const field = await address.boundingBox();
  expect(initialButton.y + initialButton.height).toBeLessThan(field.y);
  expect(Math.abs(initialButton.x - field.x)).toBeLessThan(1);
  expect(initialButton.width).toBeGreaterThan(field.width * .65);
  expect(initialButton.width).toBeLessThanOrEqual(field.width);
  expect(initialButton.height).toBeLessThanOrEqual(44);
  const inputHeading = await page.locator('.panel-heading .step-number').boundingBox();
  const resultHeading = await page.locator('.results-heading .step-number').boundingBox();
  expect(inputHeading.x).toBe(resultHeading.x);
  expect(inputHeading.width).toBe(resultHeading.width);
  expect(inputHeading.height).toBe(resultHeading.height);
  await expect(page.locator('.results-primary > .results-heading')).toBeVisible();
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press('Tab');
  if (await page.locator('#protocol').evaluate(node => document.activeElement === node)) await page.keyboard.press('Tab');
  await expect(address).toBeFocused();
  await address.fill('10.0.0.1/24');
  await address.press('Enter');
  await expect(page.locator('#network-result dd').first()).toHaveText('10.0.0.0');
  await expect(page.locator('#result-title')).toBeFocused();
  await page.getByRole('radio', { name: 'Aucun découpage', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'FLSM', exact: true })).toBeChecked();
  await expect(page.locator('#network-result')).toBeEmpty();
  // Comparer les coordonnées du document malgré le défilement clavier mobile.
  const position = await button.evaluate(node => ({ x: node.getBoundingClientRect().x + scrollX, y: node.getBoundingClientRect().y + scrollY }));
  expect(position.x).toBe(initialButton.x);
  expect(position.y).toBe(initialButton.y);
  await address.press('Enter');
  await expect(page.locator('#result-title')).toHaveText('Votre découpage FLSM');
  await expect(page.locator('.help-panel, .site-footer')).toHaveCount(0);
  await expect(page.locator('.version')).toBeVisible();
  await expect(page.getByRole('img', { name: 'CyberNet', exact: true })).toBeVisible();
});

test('numérotation à zéro : huit réseaux, intermédiaires et tous les réseaux', async ({ page }) => {
  await subdivide(page, { count: '8' });
  const rows = page.locator('#subnet-result tr[data-subnet-number]');
  await expect(rows.locator('td:first-child')).toHaveText(['0', '1', '2', '5', '6', '7']);
  await expect(rows.first().locator('td').nth(1)).toHaveText('192.168.10.0');
  await expect(rows.last().locator('td').nth(1)).toHaveText('192.168.10.224');
  await page.locator('#middle-details > summary').click();
  await expect(page.locator('#middle-details tr[data-subnet-number] td:first-child')).toHaveText(['3', '4']);
  await subdivide(page, { count: '4' });
  await expect(rows.locator('td:first-child')).toHaveText(['0', '1', '2', '3']);
  await expect(rows.last().locator('td').nth(1)).toHaveText('192.168.10.192');
  await subdivide(page, { count: '1' });
  await expect(rows.locator('td:first-child')).toHaveText(['0']);
  await expect(rows.first().locator('td').nth(1)).toHaveText('192.168.10.0');
});

test('interface compacte, saisie longue et logos locaux sur plusieurs largeurs', async ({ page }) => {
  const ipv6 = 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff/128';
  for (const width of [320, 360, 390, 430, 768, 820, 900, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByLabel('Adresse IP', { exact: true }).fill(ipv6);
    await expect(page.getByLabel('Adresse IP', { exact: true })).toHaveValue(ipv6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const address = await page.locator('#address').boundingBox();
    expect(address.x + address.width).toBeLessThanOrEqual(width);
    const print = await page.locator('#print-results').boundingBox();
    const calculate = await page.locator('.calculate-button').boundingBox();
    expect(print.x).toBeGreaterThan(calculate.x + calculate.width);
    expect(print.y).toBe(calculate.y);
    if (width === 1440) {
      expect((await page.locator('main').boundingBox()).width).toBeLessThanOrEqual(1100);
      expect(address.width).toBeGreaterThanOrEqual(500);
      expect(address.width).toBeLessThanOrEqual(580);
      expect((await page.locator('.panel-heading').boundingBox()).y).toBe(calculate.y);
    }
  }
  for (const [theme, filename] of [['dark', 'Logo_CyberNet_blanc_transparent.svg'], ['light', 'Logo_CyberNet_bleu_marine_transparent.svg']]) {
    await page.emulateMedia({ colorScheme: theme });
    const logo = page.getByRole('img', { name: 'CyberNet', exact: true });
    await expect.poll(() => logo.evaluate(img => img.currentSrc)).toContain(filename);
    await expect.poll(() => logo.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(new URL(await logo.evaluate(img => img.currentSrc)).origin).toBe(new URL(page.url()).origin);
  }
});

test('HTTP non sécurisé : calculs locaux sans bannière HTTPS', async ({ page, baseURL }) => {
  // L’origine HTTP non sécurisée est servie par le serveur de test local,
  // sans contacter un DNS, le NAS ou un service externe.
  await page.route('http://ipcalc.test/**', async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: new URL(url.pathname, baseURL).href });
    await route.fulfill({ response });
  });
  await page.goto('http://ipcalc.test/IPcalc/');
  expect(await page.evaluate(() => isSecureContext)).toBe(false);
  await expect(page.locator('#pwa-message')).toBeHidden();
  await expect(page.locator('#connection-label')).toHaveText('Calcul local');
  await expect(page.locator('#network-result dd').first()).toHaveText('192.168.10.64');
  for (const method of ['count', 'hosts', 'combined']) {
    await subdivide(page, { method, count: '3', hosts: '50' });
    await expect(page.locator('#subnet-result')).toBeVisible();
  }
  await page.getByLabel('Adresse IP', { exact: true }).fill('999.1.1.1/24');
  await page.getByLabel('Adresse IP', { exact: true }).press('Enter');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('#pwa-message')).toBeHidden();
});

test('une véritable erreur de préparation PWA reste signalée', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.serviceWorker.register = () => Promise.reject(new Error('Test : cache indisponible'));
  });
  await page.reload();
  await expect(page.locator('#pwa-message')).toContainText('cache hors connexion n’a pas pu être préparé');
  await expect(page.locator('#network-result dd').first()).toHaveText('192.168.10.64');
});

test('FLSM lisible : 4, 8, 16 réseaux, tailles réelles et aucune valeur tronquée', async ({ page }) => {
  for (const width of [1440, 1024, 900, 540, 430, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const count of ['4', '8', '16']) {
      await subdivide(page, { count });
      const rows = page.locator('#subnet-result > .table-wrapper tr[data-subnet-number]');
      const numbers = count === '4' ? ['0', '1', '2', '3'] : count === '8' ? ['0', '1', '2', '5', '6', '7'] : ['0', '1', '2', '13', '14', '15'];
      await expect(rows.locator('td:first-child')).toHaveText(numbers);
      await expect(page.locator('.subnet-header > p')).toHaveText(count === '4' ? 'Tous les sous-réseaux concernés sont affichés.' : 'Affichage des 3 premiers et des 3 derniers sous-réseaux.');
      const measures = await rows.locator('td').evaluateAll(cells => cells.map(cell => {
        const style = getComputedStyle(cell);
        const range = document.createRange();
        range.selectNodeContents(cell);
        const text = range.getBoundingClientRect();
        const box = cell.getBoundingClientRect();
        return { font: style.fontSize, weight: style.fontWeight, fontFamily: style.fontFamily, height: box.height, fits: text.left >= box.left - 1 && text.right <= box.right + 1, scrollFits: cell.scrollWidth <= cell.clientWidth + 1 };
      }));
      expect(measures.every(cell => cell.font === '16px' && cell.fontFamily.includes('monospace') && cell.fits && cell.scrollFits)).toBe(true);
      expect(measures.filter((_, index) => index % 6 === 0).every(cell => Number(cell.weight) >= 700)).toBe(true);
      if (width > 900) {
        expect(measures.every(cell => cell.height >= 55)).toBe(true);
        expect(await page.locator('.subnet-table th').first().evaluate(cell => getComputedStyle(cell).fontSize)).toBe('14px');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (count !== '4') {
        expect(await page.locator('.ellipsis-row td').evaluate(cell => getComputedStyle(cell).fontSize)).toBe('14px');
        await page.locator('#middle-details > summary').click();
        await expect(page.locator('#middle-details tr[data-subnet-number]')).toHaveCount(Number(count) - 6);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('numéros 48 et 128 sans dièse, adresses et pagination inchangées', async ({ page }) => {
  await subdivide(page, { address: '10.0.0.0/16', count: '256' });
  await page.locator('#middle-details > summary').click();
  const row48 = page.locator('#middle-details tr[data-subnet-number="48"]');
  await expect(row48.locator('td').first()).toHaveText('48');
  await expect(row48.locator('td').nth(1)).toHaveText('10.0.48.0');
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Suivants : sous-réseaux intermédiaires' }).click();
  const row128 = page.locator('#middle-details tr[data-subnet-number="128"]');
  await expect(row128.locator('td').first()).toHaveText('128');
  await expect(row128.locator('td').nth(1)).toHaveText('10.0.128.0');
  await expect(row128.locator('td').nth(4)).toHaveText('10.0.128.255');
  await page.getByRole('button', { name: 'Précédents : sous-réseaux intermédiaires' }).click();
  await expect(page.locator('#middle-details tr[data-subnet-number]').first().locator('td').first()).toHaveText('53');
  await expect(page.locator('.brand img')).toHaveCount(0);
  await expect(page.locator('.brand')).toHaveText('IPcalc');
  await expect(page.getByRole('img', { name: 'CyberNet', exact: true })).toHaveCount(1);
});

test('VLSM : cinq lignes compactes et fiche réseau initial automatique', async ({ page }) => {
  await page.getByRole('radio',{name:'VLSM',exact:true}).check();
  await expect(page.locator('#vlsm-settings')).toBeVisible();
  await expect(page.locator('.vlsm-request-row')).toHaveCount(5);
  await expect(page.locator('.vlsm-request-row input[aria-label^="Quantité"]')).toHaveValues(['1','1','1','1','1']);
  await expect(page.locator('#vlsm-base-content')).toContainText('192.168.10.64/26');
  await expect(page.locator('#vlsm-base-content')).toContainText('255.255.255.192');
  await expect(page.locator('#show-binary')).toHaveCount(0);
});

test('VLSM : saisir des quantités, classer et afficher le plan coloré', async ({ page }) => {
  await page.getByLabel('Adresse IP').fill('192.168.10.0/24');
  await page.getByRole('radio',{name:'VLSM',exact:true}).check();
  await page.getByLabel('Hôtes par réseau ligne 1').fill('12');
  await page.getByLabel('Hôtes par réseau ligne 2').fill('50');
  await page.getByLabel('Hôtes par réseau ligne 3').fill('25');
  await page.getByLabel('Hôtes par réseau ligne 4').fill('5');
  await page.getByRole('button',{name:'Planifier les sous-réseaux'}).click();
  await expect(page.locator('.vlsm-results-table tbody tr')).toHaveCount(4);
  await expect(page.locator('.vlsm-results-table tbody tr').first()).toContainText('192.168.10.0/26');
  await expect(page.locator('.vlsm-results-table tbody tr').last()).toContainText('192.168.10.112/29');
  await expect(page.locator('.vlsm-allocation-bar .vlsm-bar-segment')).toHaveCount(4);
  await expect(page.locator('.vlsm-allocation-legend')).toContainText('136 adresses non attribuées');
});

test('VLSM : refus d’un réseau trop petit et mise à jour de la fiche avant calcul', async ({ page }) => {
  await page.getByRole('radio',{name:'VLSM',exact:true}).check();
  await page.getByLabel('Adresse IP').fill('192.168.10.0/24');
  await page.getByLabel('Quantité ligne 1').fill('30');
  await page.getByLabel('Hôtes par réseau ligne 1').fill('64');
  await expect(page.locator('#vlsm-base-content')).toContainText('capacité insuffisante');
  await page.getByRole('button',{name:'Planifier les sous-réseaux'}).click();
  await expect(page.getByRole('alert')).toContainText('Capacité insuffisante');
  await expect(page.locator('.vlsm-results-table')).toHaveCount(0);
});
