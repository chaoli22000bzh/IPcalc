/** Rapport professionnel FLSM A4 — module autonome, intégrable dans IPcalc et C². */
import { subnetAt } from './ipv4.js';

export const FLSM_PRO_MAX_ROWS = 10000;
const number = value => Number(value).toLocaleString('fr-FR');

function node(tag, className = '', text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = String(text);
  return item;
}

function info(label, value) {
  const block = node('div');
  block.append(node('dt', '', label), node('dd', '', value));
  return block;
}

/**
 * Produit un DOM indépendant de l'interface IPcalc et des documents scolaires.
 * La même fonction pourra recevoir les données d'un TP C² sans requête réseau.
 */
export function buildFlsmProfessionalReport(base, plan) {
  if (!base || !plan || !Number.isSafeInteger(plan.concernedCount) || plan.concernedCount < 1) {
    throw new Error('Calculez un plan FLSM valide avant de créer le rapport.');
  }
  if (plan.concernedCount > FLSM_PRO_MAX_ROWS) {
    throw new Error('Le rapport professionnel A4 est limité à ' + number(FLSM_PRO_MAX_ROWS) +
      ' sous-réseaux. Réduisez le nombre de réseaux à imprimer.');
  }
  const report = node('section', 'professional-flsm-report');
  report.id = 'professional-report';
  report.setAttribute('aria-label', 'Rapport professionnel FLSM');
  const head = node('header', 'professional-report-head');
  const logo = node('img', 'professional-report-logo');
  logo.src = new URL('../icons/Logo_CyberNet_bleu_marine_transparent.svg', import.meta.url).href;
  logo.alt = 'CyberNet Los Angeles';
  const headings = node('div');
  headings.append(node('p', 'professional-report-kicker', 'CYBERNET · RAPPORT TECHNIQUE'),
    node('h1', '', 'Plan d’adressage IPv4 — FLSM'),
    node('p', 'professional-report-subtitle', 'Découpage en sous-réseaux de taille fixe'));
  head.append(headings, logo);
  report.append(head);

  const summary = node('section', 'professional-report-summary');
  summary.append(node('h2', '', 'Synthèse du plan d’adressage'));
  const data = node('dl', 'professional-report-fields');
  [
    ['Réseau initial', base.address + '/' + base.prefix],
    ['Masque initial', base.mask],
    ['Broadcast initial', base.broadcast ?? 'Sans broadcast'],
    ['Préfixe des sous-réseaux', '/' + plan.prefix],
    ['Masque FLSM', plan.mask],
    ['Hôtes utilisables / réseau', number(plan.usableHosts)],
    ['Sous-réseaux concernés', number(plan.concernedCount)],
    ['Capacité du réseau initial', number(plan.capacity) + ' sous-réseaux'],
  ].forEach(([label, value]) => data.append(info(label, value)));
  summary.append(data);
  const description = plan.method === 'hosts'
    ? 'Méthode B — dimensionnement selon le nombre minimal d’hôtes : ' + number(plan.minimumHosts)
    : plan.method === 'combined'
      ? 'Méthode combinée — ' + number(plan.requestedCount) + ' réseaux et ' + number(plan.minimumHosts) + ' hôtes minimum par réseau'
      : 'Méthode A — découpage selon le nombre de sous-réseaux demandés : ' + number(plan.requestedCount);
  summary.append(node('p', 'professional-report-method', description));
  if (plan.capacity > plan.concernedCount) {
    summary.append(node('p', 'professional-report-note',
      number(plan.capacity - plan.concernedCount) + ' sous-réseaux supplémentaires sont possibles mais ne font pas partie de la demande.'));
  }
  report.append(summary);

  const tableSection = node('section', 'professional-report-networks');
  tableSection.append(node('h2', '', 'Tableau complet des sous-réseaux'));
  const wrapper = node('div', 'professional-report-table-wrap');
  const table = node('table', 'professional-report-table');
  const thead = node('thead');
  const labels = ['Nº', 'Adresse réseau / CIDR', 'Premier hôte', 'Dernier hôte', 'Broadcast', 'Hôtes'];
  const titleRow = node('tr');
  labels.forEach(label => {
    const th = node('th', '', label);
    th.scope = 'col';
    titleRow.append(th);
  });
  thead.append(titleRow);
  const tbody = node('tbody');
  // Fragments pour éviter une construction quadratique et conserver tout le tableau.
  for (let start = 0; start < plan.concernedCount; start += 250) {
    const fragment = document.createDocumentFragment();
    for (let index = start; index < Math.min(start + 250, plan.concernedCount); index++) {
      const subnet = subnetAt(plan, index);
      const first = subnet.prefix === 31
        ? subnet.address
        : numberToAddress(subnet.network + 1);
      const last = subnet.prefix === 31
        ? numberToAddress(subnet.network + 1)
        : numberToAddress(subnet.network + subnet.blockSize - 2);
      const row = node('tr');
      [index, subnet.address + '/' + subnet.prefix, first, last,
        subnet.broadcast ?? '—', number(subnet.usableHosts)].forEach(value => row.append(node('td', '', value)));
      fragment.append(row);
    }
    tbody.append(fragment);
  }
  table.append(thead, tbody);
  wrapper.append(table);
  tableSection.append(wrapper);
  report.append(tableSection);
  const footer = node('footer', 'professional-report-footer',
    'CyberNet · IPcalc — Plan d’adressage FLSM · Rapport professionnel');
  report.append(footer);
  return report;
}

function numberToAddress(value) {
  return [24, 16, 8, 0].map(shift => Math.floor(value / 2 ** shift) % 256).join('.');
}

/** Déclenche le dialogue d'impression natif ; PDF texte, aucune capture. */
export function printFlsmProfessional(base, plan) {
  const previous = document.getElementById('professional-report');
  if (previous) previous.remove();
  const report = buildFlsmProfessionalReport(base, plan);
  document.querySelector('main').append(report);
  const originalTitle = document.title;
  document.title = base.address + '_FLSM_Pro';
  document.body.classList.add('print-professional');
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    document.body.classList.remove('print-professional');
    document.title = originalTitle;
    report.remove();
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  try {
    window.print();
  } catch (error) {
    restore();
    throw error;
  }
  return report;
}
