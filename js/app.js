import { parseNetwork, planSubnets, subnetAt, summaryIndices, subnetPage, binaryOctets } from './ipv4.js';
import { EXPORT_COLUMNS, exportSelection, toCSV, toText, copyText } from './exports.js';

const $ = id => document.getElementById(id);
const format = value => value.toLocaleString('fr-FR');
const form = $('calculator-form');
let current = null;
let stale = false;
let pages = { middle: { open: false, page: 0 }, extra: { open: false, page: 0 } };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showFeedback(message, error = false) {
  const feedback = $('export-feedback');
  feedback.textContent = message;
  feedback.dataset.error = String(error);
  feedback.hidden = false;
}

function binary(address, prefix) {
  const node = element('span', 'binary');
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', `Binaire : ${binaryOctets(address).join(' . ')}. ${prefix} bits réseau, ${32 - prefix} bits hôte.`);
  binaryOctets(address).forEach((octet, octetIndex) => {
    const group = element('span', 'binary-octet');
    group.setAttribute('aria-hidden', 'true');
    [...octet].forEach((bit, bitIndex) => group.append(element('span', octetIndex * 8 + bitIndex < prefix ? 'network-bit' : 'host-bit', bit)));
    node.append(group);
    if (octetIndex < 3) {
      const dot = element('span', 'binary-dot', '.');
      dot.setAttribute('aria-hidden', 'true');
      node.append(dot);
    }
  });
  return node;
}

function legend() {
  const node = element('div', 'binary-legend');
  node.append(element('span', '', 'Bits réseau'), element('span', '', 'Bits hôte (soulignés)'));
  return node;
}

function renderNetwork(base) {
  const container = $('network-result');
  container.replaceChildren();
  const banner = element('div', 'network-banner');
  const title = element('div');
  title.append(element('p', 'network-kicker', current.plan ? 'Réseau initial' : 'Réseau identifié'));
  const address = element('p', 'network-address', base.address);
  address.append(element('span', '', ` /${base.prefix}`));
  title.append(address);
  banner.append(title, element('span', 'network-badge', base.prefix === 31 ? 'Point à point' : 'IPv4'));
  const data = element('dl', 'network-data');
  const values = [base.address, base.mask, `/${base.prefix}`, base.broadcast ?? 'Sans broadcast', format(base.usableHosts)];
  EXPORT_COLUMNS.forEach((label, index) => {
    const group = element('div');
    const value = element('dd', index === 4 ? 'hosts-value' : '', values[index]);
    if ($('show-binary').checked && [0, 1, 3].includes(index) && !(index === 3 && base.broadcast === null)) value.append(binary(values[index], base.prefix));
    group.append(element('dt', '', label), value);
    data.append(group);
  });
  container.append(banner, data);
  if ($('show-binary').checked) container.append(legend());
  if (base.inputAddress !== base.address) {
    container.append(element('p', 'network-note', `${base.inputAddress}/${base.prefix} appartient au réseau ${base.address}/${base.prefix}.`));
  }
  if (base.prefix === 31) container.append(element('p', 'network-note', 'Liaison point à point : les deux adresses sont utilisables. Sans broadcast conventionnel.'));
}

function networkTable(rows, omitted = 0) {
  const wrapper = element('div', 'table-wrapper');
  const table = element('table', 'subnet-table');
  const caption = element('caption', 'sr-only', 'Caractéristiques des sous-réseaux IPv4');
  const thead = element('thead');
  const header = element('tr');
  ['Nº', ...EXPORT_COLUMNS].forEach(label => {
    const cell = element('th', '', label);
    cell.scope = 'col';
    header.append(cell);
  });
  thead.append(header);
  const tbody = element('tbody');
  rows.forEach((network, index) => {
    if (omitted && index === 3) {
      const gap = element('tr', 'ellipsis-row');
      const cell = element('td', '', `··· ${format(omitted)} sous-réseau${omitted > 1 ? 'x' : ''} intermédiaire${omitted > 1 ? 's' : ''} ···`);
      cell.colSpan = 6;
      gap.append(cell);
      tbody.append(gap);
    }
    const row = element('tr');
    row.dataset.subnetNumber = String(network.index);
    const values = [`#${format(network.index)}`, network.address, network.mask, `/${network.prefix}`, network.broadcast ?? 'Sans broadcast', format(network.usableHosts)];
    values.forEach((value, column) => {
      const cell = element('td', '', value);
      cell.dataset.label = column === 0 ? 'Nº' : EXPORT_COLUMNS[column - 1];
      if ($('show-binary').checked && [1, 2, 4].includes(column) && !(column === 4 && network.broadcast === null)) cell.append(binary(value, network.prefix));
      row.append(cell);
    });
    tbody.append(row);
  });
  table.append(caption, thead, tbody);
  wrapper.append(table);
  return wrapper;
}

function pageDetails(kind, title, start, end) {
  const details = element('details', 'pages-details');
  details.id = `${kind}-details`;
  details.open = pages[kind].open;
  const summary = element('summary', '', title);
  details.append(summary);
  function populate() {
    const old = details.querySelector('.page-body');
    if (old) old.remove();
    if (!details.open) return;
    const result = subnetPage(current.plan, { start, end, page: pages[kind].page });
    const body = element('div', 'page-body');
    body.append(element('p', '', `${format(result.total)} sous-réseaux dans ce périmètre. Au maximum 50 par page.`), networkTable(result.items));
    const navigation = element('div', 'pagination');
    for (const [direction, label] of [[-1, 'Précédents'], [1, 'Suivants']]) {
      const button = element('button', 'button button-small button-outline', label);
      button.type = 'button';
      button.disabled = direction < 0 ? result.page === 0 : result.page + 1 >= result.pageCount;
      button.setAttribute('aria-label', `${label} : ${kind === 'middle' ? 'sous-réseaux intermédiaires' : 'sous-réseaux non demandés'}`);
      button.addEventListener('click', () => {
        pages[kind].page += direction;
        populate();
        syncVisibleCount();
        const nextButton = details.querySelector(`button[aria-label="${button.getAttribute('aria-label')}"]`);
        if (nextButton && !nextButton.disabled) nextButton.focus();
        else summary.focus();
      });
      navigation.append(button);
      if (direction < 0) navigation.append(element('span', '', `Page ${format(result.page + 1)} / ${format(result.pageCount)}`));
    }
    body.append(navigation);
    details.append(body);
  }
  populate();
  details.addEventListener('toggle', () => {
    pages[kind].open = details.open;
    populate();
    syncVisibleCount();
  });
  return details;
}

function renderSubnets(plan) {
  const container = $('subnet-result');
  container.replaceChildren();
  container.hidden = !plan;
  if (!plan) return;
  const heading = element('div', 'subnet-header');
  heading.append(element('h3', '', `${format(plan.concernedCount)} sous-réseau${plan.concernedCount > 1 ? 'x' : ''} ${plan.requestedCount === null ? 'possibles' : 'demandés'}`));
  heading.append(element('p', '', plan.concernedCount > 6 ? 'Les trois premiers et les trois derniers, comme sur la calculatrice papier.' : 'Tous les sous-réseaux concernés sont affichés.'));
  const metrics = element('div', 'subnet-metrics');
  for (const [label, value] of [['Préfixe', `/${plan.prefix}`], ['Hôtes / réseau', format(plan.usableHosts)], ['Capacité totale', format(plan.capacity)]]) {
    const metric = element('span', 'metric-chip', `${label} `);
    metric.append(element('strong', '', value));
    metrics.append(metric);
  }
  heading.append(metrics);
  container.append(heading, networkTable(summaryIndices(plan.concernedCount).map(index => subnetAt(plan, index)), Math.max(0, plan.concernedCount - 6)));
  if (plan.prefix === 31) container.append(element('p', 'subnet-note', 'Sous-réseaux /31 : liaisons point à point, deux adresses utilisables et sans broadcast conventionnel.'));
  if (plan.concernedCount > 6) container.append(pageDetails('middle', `Consulter les ${format(plan.concernedCount - 6)} sous-réseaux intermédiaires`, 3, plan.concernedCount - 3));
  if (plan.capacity > plan.concernedCount) {
    const count = plan.capacity - plan.concernedCount;
    container.append(element('p', 'subnet-note', `La capacité est de ${format(plan.capacity)} sous-réseaux. Les ${format(count)} supplémentaires ne font pas partie de votre demande.`));
    container.append(pageDetails('extra', `Consulter les ${format(count)} sous-réseaux non demandés`, plan.concernedCount, plan.capacity));
  }
  if ($('show-binary').checked) container.append(legend());
}

function visibleIndices() {
  if (!current?.plan) return [];
  const plan = current.plan;
  const indices = summaryIndices(plan.concernedCount);
  for (const [kind, start, end] of [['middle', 3, plan.concernedCount - 3], ['extra', plan.concernedCount, plan.capacity]]) {
    if (pages[kind].open && end > start) indices.push(...subnetPage(plan, { start, end, page: pages[kind].page }).items.map(row => row.index));
  }
  return [...new Set(indices)];
}

function syncVisibleCount() {
  if (!current?.plan) return;
  $('export-scope').options[0].textContent = `Sous-réseaux visibles (${format(visibleIndices().length)})`;
}

function render() {
  $('results').hidden = false;
  $('network-result').hidden = false;
  $('result-title').textContent = current.plan ? 'Votre découpage FLSM' : 'Résultat du calcul';
  renderNetwork(current.base);
  renderSubnets(current.plan);
  $('scope-field').hidden = !current.plan;
  $('export-scope').options[1].textContent = current.plan?.requestedCount === null ? 'Ensemble (méthode hôtes)' : 'Sous-réseaux demandés';
  syncVisibleCount();
}

function clearErrors() {
  $('calculation-error').hidden = true;
  for (const id of ['address', 'mask', 'count', 'hosts']) {
    $(id).removeAttribute('aria-invalid');
    $(id).setAttribute('aria-describedby', `${id}-help`);
  }
}

function calculate(focus = true) {
  clearErrors();
  $('export-feedback').hidden = true;
  try {
    if (form.elements.mode.value === 'vlsm') throw new Error('VLSM indisponible : moteur non développé.');
    if ($('protocol').value !== 'ipv4') throw new Error('IPv6 indisponible : moteur non développé.');
    const base = parseNetwork($('address').value, $('mask').value);
    const plan = form.elements.mode.value === 'subnets' ? planSubnets(base, { method: $('method').value, count: $('count').value, hosts: $('hosts').value }) : null;
    current = { base, plan };
    stale = false;
    pages = { middle: { open: false, page: 0 }, extra: { open: false, page: 0 } };
    $('stale-notice').hidden = true;
    $('copy-results').disabled = false;
    $('export-csv').disabled = false;
    $('export-scope').value = 'visible';
    render();
    $('result-announcement').textContent = `Réseau ${base.address}/${base.prefix} calculé.${plan ? ` ${format(plan.concernedCount)} sous-réseaux /${plan.prefix}.` : ''}`;
    if (focus) $('result-title').focus({ preventScroll: true });
  } catch (error) {
    invalidateResults();
    $('results').hidden = true;
    $('calculation-error').textContent = error.message;
    $('calculation-error').hidden = false;
    const field = $(error.field ?? 'address');
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', `${field.id}-help calculation-error`);
      if (focus) field.focus();
    }
  }
}

function syncSettings() {
  const subdivide = form.elements.mode.value === 'subnets';
  $('subnet-settings').hidden = !subdivide;
  $('method').disabled = !subdivide;
  $('count-field').hidden = $('method').value === 'hosts';
  $('hosts-field').hidden = $('method').value === 'count';
  $('count').disabled = !subdivide || $('method').value === 'hosts';
  $('hosts').disabled = !subdivide || $('method').value === 'count';
  $('method-help').textContent = $('method').value === 'hosts' ? 'Sans nombre demandé, tous les sous-réseaux possibles sont concernés.' : 'Tous les sous-réseaux ont la même taille.';
}

function invalidateResults() {
  current = null;
  stale = true;
  pages = { middle: { open: false, page: 0 }, extra: { open: false, page: 0 } };
  $('network-result').replaceChildren();
  $('network-result').hidden = true;
  $('subnet-result').replaceChildren();
  $('subnet-result').hidden = true;
  $('scope-field').hidden = true;
  $('export-scope').value = 'visible';
  $('export-scope').options[0].textContent = 'Sous-réseaux visibles';
  $('result-title').textContent = 'Résultat du calcul';
  $('result-announcement').textContent = '';
  $('copy-results').disabled = true;
  $('export-csv').disabled = true;
  $('export-feedback').textContent = '';
  $('export-feedback').hidden = true;
}

function markStale() {
  clearErrors();
  invalidateResults();
  $('results').hidden = false;
  $('stale-notice').hidden = false;
}

form.addEventListener('submit', event => { event.preventDefault(); calculate(); });
form.addEventListener('input', markStale);
form.addEventListener('change', () => { syncSettings(); markStale(); });
$('show-binary').addEventListener('change', () => { if (current) render(); });
$('export-scope').addEventListener('change', () => { $('export-feedback').hidden = true; });

function selection() {
  if (!current || stale) throw new Error('Relancez le calcul avant de copier ou d’exporter.');
  return exportSelection(current, $('export-scope').value, visibleIndices());
}

$('copy-results').addEventListener('click', async () => {
  try {
    const selected = selection();
    await copyText(toText(selected));
    showFeedback(`Copié : ${selected.label.toLowerCase()} (${format(selected.rows.length)} réseau${selected.rows.length > 1 ? 'x' : ''}).`);
  } catch (error) { showFeedback(error.message, true); }
});

$('export-csv').addEventListener('click', () => {
  try {
    const selected = selection();
    const url = URL.createObjectURL(new Blob([toCSV(selected)], { type: 'text/csv;charset=utf-8' }));
    const link = element('a');
    link.href = url;
    const scope = current.plan ? $('export-scope').value : 'reseau';
    link.download = `IPcalc-${current.base.address}-${current.base.prefix}-${scope}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showFeedback(`Exporté : ${selected.label.toLowerCase()} (${format(selected.rows.length)} réseau${selected.rows.length > 1 ? 'x' : ''}). CSV UTF-8, séparateur point-virgule.`);
  } catch (error) { showFeedback(error.message, true); }
});

syncSettings();
calculate(false);
