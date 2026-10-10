import { parseIPv6 } from './ipv6.js';
import { downloadFlsmA3 } from './pdf-a3-flsm.js';
import { downloadAddressingA4 } from './pdf-a4.js';
import { parseNetwork, planSubnets, subnetAt, summaryIndices, subnetPage, binaryOctets } from './ipv4.js';
import { EXPORT_COLUMNS } from './exports.js';

const $ = id => document.getElementById(id);
const format = value => value.toLocaleString('fr-FR');
const form = $('calculator-form');
let current = null;
let pages = { middle: { open: false, page: 0 }, extra: { open: false, page: 0 } };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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
    const values = [format(network.index), network.address, network.mask, `/${network.prefix}`, network.broadcast ?? 'Sans broadcast', format(network.usableHosts)];
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
  heading.append(element('p', '', plan.concernedCount > 6 ? 'Affichage des 3 premiers et des 3 derniers sous-réseaux.' : 'Tous les sous-réseaux concernés sont affichés.'));
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

function renderIPv6(info) {
  const container=$('network-result');
  container.replaceChildren();
  const banner=element('div','network-banner');
  banner.append(element('p','network-kicker','Adresse IPv6 identifiée'),element('span','network-badge','IPv6'));
  container.append(banner);

  // Adresses en pleine largeur, verticalement : la forme développée ne se coupe jamais.
  const addresses=element('dl','ipv6-address-details');
  const addressFields=[
    ['Adresse développée',info.expanded,'ipv6-full-address'],
    ['Adresse abrégée',info.address,'ipv6-short-address'],
    ['Préfixe réseau',info.network+'/'+info.prefix,'ipv6-network-prefix'],
    ['Dernière adresse du bloc',info.lastAddress,'ipv6-last-address']
  ];
  if(info.interfaceId)addressFields.push(['Identifiant d’interface (/64)',info.interfaceId,'ipv6-interface-id']);
  for(const [label,value,className] of addressFields){
    const group=element('div','ipv6-address-row');
    group.append(element('dt','',label),element('dd',className,value));
    addresses.append(group);
  }
  const detailLayout=element('div','ipv6-detail-layout');
  detailLayout.append(addresses);

  const other=element('dl','ipv6-summary-data');
  const fields=[
    ['Préfixe CIDR','/'+info.prefix+(info.assumedPrefix?' (adresse seule, par défaut)':'')],
    ['Type d’adresse',info.type],
    ['Portée',info.scope],
    ['Adresses du bloc',`2^${info.addressExponent} — ${BigInt(info.addressCount).toLocaleString('fr-FR')}`],
    ['Sous-réseaux /64 possibles',info.subnets64Exponent===null
      ? '0 (préfixe plus long que /64)'
      : `2^${info.subnets64Exponent} — ${BigInt(info.subnets64).toLocaleString('fr-FR')}`]
  ];
  for(const [label,value] of fields){
    const group=element('div');
    group.append(element('dt','',label),element('dd','ipv6-value',value));
    other.append(group);
  }
  detailLayout.append(other);
  container.append(detailLayout,element('p','network-note','IPv6 ne possède pas de broadcast. Le préfixe désigne un bloc d’adresses, sans notion de premier ou dernier hôte utilisable.'));
  $('subnet-result').replaceChildren();
  $('subnet-result').hidden=true;
}
function render() {
  $('results').hidden = false;
  $('network-result').hidden = false;
  $('result-title').textContent = current.protocol==='ipv6'?'Informations IPv6':current.plan ? 'Votre découpage FLSM' : 'Résultat du calcul';
  if(current.protocol==='ipv6')renderIPv6(current.base);
  else {renderNetwork(current.base);renderSubnets(current.plan);}
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
  try {
    if (form.elements.mode.value === 'vlsm') throw new Error('VLSM indisponible : moteur non développé.');
    const protocol=detectedProtocol();
    if(protocol==='ipv6' && form.elements.mode.value !== 'simple')
      throw new Error('Le découpage FLSM IPv6 n’est pas encore disponible. Choisissez « Aucun découpage ».');
    const base = protocol==='ipv6' ? parseIPv6($('address').value,$('mask').value) : parseNetwork($('address').value, $('mask').value);
    const plan = protocol==='ipv4' && form.elements.mode.value === 'subnets' ? planSubnets(base, { method: $('method').value, count: $('count').value, hosts: $('hosts').value }) : null;
    current = { protocol,base,plan };
    updatePdfAvailability();
    pages = { middle: { open: false, page: 0 }, extra: { open: false, page: 0 } };
    $('stale-notice').hidden = true;
    render();
    $('result-announcement').textContent = protocol==='ipv6' ? `Adresse IPv6 ${base.address}, préfixe ${base.network}/${base.prefix}.` : `Réseau ${base.address}/${base.prefix} calculé.${plan ? ` ${format(plan.concernedCount)} sous-réseaux /${plan.prefix}.` : ''}`;
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

function detectedProtocol(){
  return $('address').value.trim().split('/')[0].includes(':')?'ipv6':'ipv4';
}
function syncProtocol(){
  const ipv6=detectedProtocol()==='ipv6';
  $('protocol').value=ipv6?'ipv6':'ipv4';
  $('address-help').textContent=ipv6?'Adresse IPv6 abrégée ou complète. Sans préfixe, analyse de l’adresse seule (/128).':'IPv4 avec ou sans CIDR. Une adresse d’hôte est ramenée à son réseau.';
  $('mask').placeholder=ipv6?'/64':'255.255.255.192 ou /26';
  $('mask').inputMode=ipv6?'numeric':'decimal';
  $('mode-fieldset').hidden=ipv6;
  if(ipv6)form.elements.mode.value='simple';
  $('show-binary').closest('label').hidden=ipv6;
  $('calculate-label').textContent=ipv6?'Afficher les informations':'Calculer le réseau';
}
function syncSettings() {
  syncProtocol();
  const subdivide = detectedProtocol()==='ipv4' && form.elements.mode.value === 'subnets';
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
  updatePdfAvailability();
  pages = { middle: { open: false, page: 0 }, extra: { open: false, page: 0 } };
  $('network-result').replaceChildren();
  $('network-result').hidden = true;
  $('subnet-result').replaceChildren();
  $('subnet-result').hidden = true;
  $('result-title').textContent = 'Résultat du calcul';
  $('result-announcement').textContent = '';
}

function markStale() {
  syncSettings();
  clearErrors();
  invalidateResults();
  $('results').hidden = false;
  $('stale-notice').hidden = false;
}

form.addEventListener('submit', event => { event.preventDefault(); calculate(); });
form.addEventListener('input', markStale);
form.addEventListener('change', () => { syncSettings(); markStale(); });
$('show-binary').addEventListener('change', () => { if (current) render(); });
syncSettings();
calculate(false);

function updatePdfAvailability() {
  const button=$('print-results');
  const available=Boolean(current) && current.protocol!=='ipv6';
  const flsm=Boolean(current?.plan);
  button.disabled=!available;
  button.setAttribute('aria-label',available?'Télécharger une fiche pédagogique PDF':'Imprimer — calcul indisponible');
  button.title=available?'Télécharger une fiche pédagogique PDF':'Impression indisponible';
  $('print-help').textContent=current?.protocol==='ipv6'?'PDF IPv6 à venir':available?(flsm?'PDF A3':'PDF A4'):'À venir';
}
$('print-results').addEventListener('click',()=>{
  if(!current)return;
  const flsm=Boolean(current.plan);
  $('pdf-a4-error').hidden=true;
  $('pdf-a4-title').textContent=flsm?'Fiche IPv4 et sous-réseaux FLSM':'Fiche d’adressage IPv4';
  $('pdf-a4-description').textContent=flsm?'Choisir un PDF A3 paysage à télécharger :':'Choisir un PDF A4 portrait à télécharger :';
  $('pdf-a4-dialog').showModal();
});
function exportDocument(corrected) {
  if(!current)return;
  try {
    if(current.plan)downloadFlsmA3(current.base,current.plan,corrected);
    else downloadAddressingA4(current.base,corrected);
    $('pdf-a4-dialog').close();
  }catch(error){
    $('pdf-a4-error').textContent='Impossible de générer le PDF : '+error.message;
    $('pdf-a4-error').hidden=false;
  }
}
$('pdf-a4-student').addEventListener('click',()=>exportDocument(false));
$('pdf-a4-corrected').addEventListener('click',()=>exportDocument(true));
updatePdfAvailability();
