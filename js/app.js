import { describeVlsmBase, summarizeVlsmRequests, planVlsm, VLSM_MAX_SUBNETS, VLSM_PAGE_SIZE } from './vlsm.js?v=2.0.0-step3.0';
import { parseIPv6 } from './ipv6.js?v=2.0.0-step3.0';
import { downloadFlsmA3 } from './pdf-a3-flsm.js?v=2.0.0-step3.0';
import { downloadAddressingA4 } from './pdf-a4.js?v=2.0.0-step3.0';
import { printFlsmProfessional } from './professional-flsm.js?v=2.0.0-step3.7';
import { printIPv4Professional } from './professional-ipv4.js?v=2.0.0-step3.7';
import { printIPv6Professional } from './professional-ipv6.js?v=2.0.0-step3.8';
import { parseNetwork, planSubnets, subnetAt, summaryIndices, subnetPage } from './ipv4.js?v=2.0.0-step3.0';
import { EXPORT_COLUMNS } from './exports.js?v=2.0.0-step3.0';

const $ = id => document.getElementById(id);
const format = value => value.toLocaleString('fr-FR');
function powerOfTwo(value, count) {
  const wrapper=element('span','ipv6-power-expression');
  wrapper.append(document.createTextNode('2'),element('sup','ipv6-power-exponent',String(value)));
  wrapper.append(document.createTextNode(' = '+BigInt(count).toLocaleString('fr-FR')));
  return wrapper;
}
const form = $('calculator-form');
let current = null;
let pages = { middle: { open: false, page: 0 }, extra: { open: false, page: 0 } };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
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
    group.append(element('dt', '', label), value);
    data.append(group);
  });
  container.append(banner, data);
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
        row.append(cell);
    });
    tbody.append(row);
  });
  table.append(caption, thead, tbody);
  wrapper.append(table);
  return wrapper;
}

function pageDetails(kind, title, start, end) {
  // Conserver le plan lié à cet accordéon : un événement 'toggle' peut être
  // livré après qu'un changement de saisie a invalidé les anciens résultats.
  const plan = current?.plan;
  const details = element('details', 'pages-details');
  details.id = `${kind}-details`;
  details.open = pages[kind].open;
  const summary = element('summary', '', title);
  details.append(summary);
  function populate() {
    if (current?.plan !== plan || !plan) return;
    const old = details.querySelector('.page-body');
    if (old) old.remove();
    if (!details.open) return;
    const result = subnetPage(plan, { start, end, page: pages[kind].page });
    const body = element('div', 'page-body');
    body.append(element('p', '', `${format(result.total)} sous-réseaux dans ce périmètre. Au maximum 50 par page.`), networkTable(result.items));
    const navigation = element('div', 'pagination');
    for (const [direction, label] of [[-1, 'Précédents'], [1, 'Suivants']]) {
      const button = element('button', 'button button-small button-outline', label);
      button.type = 'button';
      button.disabled = direction < 0 ? result.page === 0 : result.page + 1 >= result.pageCount;
      button.setAttribute('aria-label', `${label} : ${kind === 'middle' ? 'sous-réseaux intermédiaires' : 'sous-réseaux non demandés'}`);
      button.addEventListener('click', () => {
        if (!details.isConnected || current?.plan !== plan) return;
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
    if (!details.isConnected || current?.plan !== plan) return;
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
    ['Nombre total d’adresses IPv6',powerOfTwo(info.addressExponent,info.addressCount)],
    ['Sous-réseaux /64 possibles',info.subnets64Exponent===null
      ? '0 (préfixe plus long que /64)'
      : info.subnets64Exponent===0
        ? '1 (2 à la puissance 0)'
        : powerOfTwo(info.subnets64Exponent,info.subnets64)]
  ];
  for(const [label,value] of fields){
    const group=element('div');
    const dd=element('dd','ipv6-value');
    if(typeof value==='string')dd.textContent=value;
    else dd.append(value);
    group.append(element('dt','',label),dd);
    other.append(group);
  }
  detailLayout.append(other);
  container.append(detailLayout,element('p','network-note','IPv6 ne possède pas de broadcast. Le préfixe désigne un bloc d’adresses, sans notion de premier ou dernier hôte utilisable.'));
  $('subnet-result').replaceChildren();
  $('subnet-result').hidden=true;
}
// Une ligne de besoin correspond à plusieurs réseaux de taille identique.
let vlsmRequests=Array.from({length:5},(_,i)=>({id:i+1,quantity:'1',hosts:''}));
let nextVlsmId=6;
let vlsmPage=0;
const vlsmColors=['#28699c','#218e81','#d39737','#8976ba','#d46f77','#4c96b0','#a28b67','#5d9a72'];
function readVlsmRequests(){
  const filled=vlsmRequests.filter(r=>r.hosts.trim()!=='');
  if(!filled.length)throw new Error('Indiquez au moins un nombre d’hôtes dans les demandes VLSM.');
  if(vlsmRequests.some(r=>r.hosts.trim()==='' && r.quantity!=='1'))
    throw new Error('Complétez les lignes dont la quantité est différente de 1.');
  return filled.map(({quantity,hosts})=>({quantity,hosts}));
}
function renderVlsmRequestList(){
  const list=$('vlsm-request-list');list.replaceChildren();
  vlsmRequests.forEach((request,index)=>{
    const row=element('div','vlsm-request-row');
    row.append(element('span','vlsm-row-number',String(index+1)));
    for(const [name,caption] of [['quantity','Quantité'],['hosts','Hôtes par réseau']]){
      const input=element('input','vlsm-number-input');
      input.type='text';input.inputMode='numeric';
      input.value=request[name];input.autocomplete='off';
      input.setAttribute('aria-label',caption+' ligne '+(index+1));
      input.addEventListener('input',()=>{request[name]=input.value;markStale();});
      row.append(input);
    }
    const remove=element('button','vlsm-remove','×');remove.type='button';
    remove.setAttribute('aria-label','Supprimer la demande '+(index+1));
    remove.disabled=vlsmRequests.length===1;
    remove.addEventListener('click',()=>{
      vlsmRequests=vlsmRequests.filter(x=>x.id!==request.id);
      renderVlsmRequestList();markStale();
    });
    row.append(remove);list.append(row);
  });
}
function refreshVlsmPreview(){
  const content=$('vlsm-base-content');content.replaceChildren();
  let base;
  try{base=parseNetwork($('address').value,$('mask').value);}
  catch{
    content.append(element('p','vlsm-preview-help','Saisissez une adresse IPv4 et un préfixe valides pour afficher les caractéristiques du réseau.'));
    return;
  }
  const detail=describeVlsmBase(base);
  const items=[
    ['Adresse réseau',detail.cidr],['Masque décimal',detail.mask],
    ['Adresse de diffusion',detail.broadcast??'Sans broadcast (/31)'],
    ['Adresses totales',format(detail.totalAddresses)],
    ['Hôtes utilisables sans découpage',format(detail.usableHosts)]
  ];
  const dl=element('dl','vlsm-base-list');
  for(const [label,value] of items){
    const group=element('div');
    group.append(element('dt','',label),element('dd','',value));dl.append(group);
  }
  content.append(dl);
  try{
    const requests=readVlsmRequests();
    const summary=summarizeVlsmRequests(base,requests);
    $('vlsm-count').textContent=format(summary.subnetCount)+' sous-réseaux demandés.';
    const status=element('p','vlsm-preview-status'+(summary.fits?'':' vlsm-preview-error'),
      format(summary.requiredAddresses)+' adresses nécessaires sur '+format(detail.totalAddresses)
      +(summary.fits?' ; '+format(summary.remainingAddresses)+' non attribuées.':' ; capacité insuffisante.'));
    content.append(status);
  }catch(error){
    $('vlsm-count').textContent='Saisissez les besoins pour calculer le nombre de réseaux.';
    if(vlsmRequests.some(r=>r.hosts.trim()!==''))content.append(element('p','vlsm-preview-error',error.message));
  }
}
function renderVlsm(plan){
  const network=$('network-result');network.replaceChildren();
  network.append(element('div','vlsm-results-intro',
    format(plan.subnetCount)+' sous-réseaux attribués dans '+plan.initial.cidr));
  const barPanel=element('div','vlsm-allocation-panel');
  barPanel.append(element('h3','','Occupation de l’espace d’adressage'));
  const bar=element('div','vlsm-allocation-bar');
  bar.setAttribute('role','img');
  bar.setAttribute('aria-label',format(plan.usedAddresses)+' adresses attribuées et '+format(plan.freeAddresses)+' non attribuées sur '+format(plan.initial.totalAddresses));
  // La largeur est proportionnelle aux blocs, en nombre d'adresses, pas aux hôtes utilisables.
  plan.groups.forEach(group=>{
    const seg=element('span','vlsm-bar-segment');
    seg.style.width=(group.addressCost/plan.initial.totalAddresses*100)+'%';
    seg.style.backgroundColor=vlsmColors[group.sourceIndex%vlsmColors.length];
    seg.title=group.quantity+' réseaux /'+group.prefix+' : '+group.addressCost+' adresses';
    bar.append(seg);
  });
  if(plan.freeAddresses){
    const free=element('span','vlsm-bar-free');
    free.style.width=(plan.freeAddresses/plan.initial.totalAddresses*100)+'%';
    free.title=format(plan.freeAddresses)+' adresses non attribuées';
    bar.append(free);
  }
  barPanel.append(bar);
  const legend=element('div','vlsm-allocation-legend');
  legend.append(element('span','',format(plan.usedAddresses)+' adresses attribuées'));
  legend.append(element('span','',format(plan.freeAddresses)+' adresses non attribuées'));
  barPanel.append(legend);network.append(barPanel);
  const other=$('subnet-result');other.replaceChildren();other.hidden=false;
  const wrapper=element('div','table-wrapper');
  const table=element('table','subnet-table vlsm-results-table');
  const header=element('tr');
  ['Nº','Hôtes demandés','Hôtes disponibles','Adresse réseau / CIDR','Broadcast','Masque décimal'].forEach(label=>{
    const cell=element('th','',label);cell.scope='col';header.append(cell);
  });
  const thead=element('thead');thead.append(header);table.append(thead);
  const tbody=element('tbody');
  const pageCount=Math.ceil(plan.rows.length/VLSM_PAGE_SIZE);
  vlsmPage=Math.min(vlsmPage,pageCount-1);
  const first=vlsmPage*VLSM_PAGE_SIZE;
  plan.rows.slice(first,first+VLSM_PAGE_SIZE).forEach(row=>{
    const tr=element('tr');tr.dataset.subnetNumber=String(row.index);
    const cells=[row.index,row.requestedHosts,row.usableHosts,row.cidr,row.broadcast??'Sans broadcast (/31)',row.mask];
    cells.forEach((value,i)=>{
      const td=element('td','',String(value));td.dataset.label=header.children[i].textContent;
      if(i===0){
        const dot=element('span','vlsm-row-dot');
        dot.style.backgroundColor=vlsmColors[row.sourceIndex%vlsmColors.length];
        td.prepend(dot);
      }
      tr.append(td);
    });tbody.append(tr);
  });
  table.append(tbody);wrapper.append(table);other.append(wrapper);
  // Version complète réservée à l'impression A4, indépendante de la pagination.
  const printWrapper=element('div','vlsm-print-table-wrapper');
  const printTable=element('table','vlsm-print-table');
  const printHead=element('thead'),printHeader=element('tr');
  ['Nº','Hôtes demandés','Hôtes disponibles','Adresse réseau / CIDR','Broadcast','Masque décimal'].forEach(label=>{
    const th=element('th','',label);printHeader.append(th);
  });
  printHead.append(printHeader);printTable.append(printHead);
  const printBody=element('tbody');
  // Construit lors de l'impression, pour ne pas créer plusieurs milliers de nœuds en consultation.
  printWrapper.append(printTable);other.append(printWrapper);
  printWrapper.dataset.ready='false';

  if(pageCount>1){
    const nav=element('nav','vlsm-pagination');
    nav.setAttribute('aria-label','Pages du plan VLSM');
    const previous=element('button','button button-small button-outline','Précédent');
    previous.type='button';previous.disabled=vlsmPage===0;
    previous.addEventListener('click',()=>{vlsmPage--;renderVlsm(plan);});
    const following=element('button','button button-small button-outline','Suivant');
    following.type='button';following.disabled=vlsmPage===pageCount-1;
    following.addEventListener('click',()=>{vlsmPage++;renderVlsm(plan);});
    nav.append(previous,element('span','',
      'Réseaux '+format(first)+' à '+format(Math.min(first+VLSM_PAGE_SIZE,plan.rows.length)-1)
      +' sur '+format(plan.rows.length)+'  |  Page '+format(vlsmPage+1)+' / '+format(pageCount)),following);
    other.append(nav);
  }
}

function render() {
  $('results').hidden = false;
  $('network-result').hidden = false;
  $('result-title').textContent = current.protocol==='ipv6'?'Informations IPv6':current.vlsm?'Plan VLSM':current.plan?'Votre découpage FLSM':'Résultat du calcul';
  if(current.protocol==='ipv6')renderIPv6(current.base);
  else if(current.vlsm)renderVlsm(current.vlsm);
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
    const protocol=detectedProtocol();
    if(protocol==='ipv6' && form.elements.mode.value !== 'simple')
      throw new Error('Le découpage FLSM IPv6 n’est pas encore disponible. Choisissez « Aucun découpage ».');
    const base = protocol==='ipv6' ? parseIPv6($('address').value,$('mask').value) : parseNetwork($('address').value, $('mask').value);
    const mode=form.elements.mode.value;
    const plan = protocol==='ipv4' && mode === 'subnets' ? planSubnets(base, { method: $('method').value, count: $('count').value, hosts: $('hosts').value }) : null;
    const vlsm=protocol==='ipv4' && mode==='vlsm' ? planVlsm(base,readVlsmRequests()) : null;
    vlsmPage=0;
    current = { protocol,base,plan,vlsm };
    updatePdfAvailability();
    pages = { middle: { open: false, page: 0 }, extra: { open: false, page: 0 } };
    $('stale-notice').hidden = true;
    render();
    refreshPrintSummary();
    $('result-announcement').textContent = protocol==='ipv6' ? `Adresse IPv6 ${base.address}, préfixe ${base.network}/${base.prefix}.` : vlsm ? `Plan VLSM : ${vlsm.rows.length} sous-réseaux calculés.` : `Réseau ${base.address}/${base.prefix} calculé.${plan ? ` ${format(plan.concernedCount)} sous-réseaux /${plan.prefix}.` : ''}`;
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
  const showVlsm=detectedProtocol()==='ipv4' && form.elements.mode.value==='vlsm';
  $('vlsm-settings').hidden=!showVlsm;
  $('calculate-label').textContent=showVlsm?'Planifier les sous-réseaux':detectedProtocol()==='ipv6'?'Afficher les informations':'Calculer le réseau';
  if(showVlsm)refreshVlsmPreview();
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
  $('print-summary').hidden=true;
  $('print-summary-content').replaceChildren();
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
renderVlsmRequestList();
$('vlsm-add').addEventListener('click',()=>{
  if(vlsmRequests.length>=100)return;
  vlsmRequests.push({id:nextVlsmId++,quantity:'1',hosts:''});
  renderVlsmRequestList();markStale();
});
syncSettings();
calculate(false);

function refreshPrintSummary(){
  const box=$('print-summary'),content=$('print-summary-content');
  content.replaceChildren();
  if(!current?.vlsm){box.hidden=true;return;}
  const {base,vlsm}=current;
  box.hidden=false;
  $('print-summary-title').textContent='Plan VLSM';
  const dl=element('dl','print-summary-network');
  const fields=[
    ['Réseau initial',base.address+'/'+base.prefix],
    ['Masque décimal',base.mask],
    ['Adresse de diffusion',base.broadcast??'Sans broadcast'],
    ['Adresses totales',format(base.blockSize)],
    ['Hôtes utilisables',format(base.usableHosts)]
  ];
  for(const [label,value] of fields){
    const cell=element('div');
    cell.append(element('dt','',label),element('dd','',value));
    dl.append(cell);
  }
  content.append(dl);
}
function updatePdfAvailability(){
  const print=$('print-results');
  const vlsm=Boolean(current?.vlsm);
  const legacy=Boolean(current)&&current.protocol==='ipv4'&&!vlsm;
  const ipv6=Boolean(current)&&current.protocol==='ipv6';
  // Le bouton historique conserve ses deux PDF scolaires en IPv4 et FLSM.
  // En mode VLSM, la même icône ouvre l'impression A4 de Firefox.
  print.disabled=!vlsm&&!legacy&&!ipv6;
  print.setAttribute('aria-label',vlsm?'Imprimer le plan VLSM A4':legacy?'Télécharger une fiche pédagogique PDF':ipv6?'Imprimer la fiche professionnelle IPv6 A4':'Impression indisponible');
  print.title=vlsm?'Imprimer le plan VLSM A4 ou enregistrer en PDF':legacy?'Télécharger une fiche pédagogique PDF':ipv6?'Imprimer la fiche professionnelle IPv6 A4':'Impression indisponible';
  $('print-help').textContent=vlsm?'Impression VLSM A4':legacy?(current.plan?'PDF A3 / A4 Pro':'PDF A4 / A4 Pro'):ipv6?'PDF A4 Pro':'À venir';
}
$('print-results').addEventListener('click',()=>{
  if(!current)return;
  if(current.protocol==='ipv6'){
    printIPv6Professional(current.base);
    return;
  }
  if(current.protocol!=='ipv4')return;
  if(current.vlsm){
    refreshPrintSummary();
    const printWrapper=$('subnet-result').querySelector('.vlsm-print-table-wrapper');
    if(printWrapper && printWrapper.dataset.ready!=='true'){
      const table=printWrapper.querySelector('table');
      const tbody=element('tbody');
      current.vlsm.rows.forEach(row=>{
        const tr=element('tr');
        [row.index,row.requestedHosts,row.usableHosts,row.cidr,row.broadcast??'Sans broadcast (/31)',row.mask].forEach(value=>
          tr.append(element('td','',String(value))));
        tbody.append(tr);
      });
      table.append(tbody);printWrapper.dataset.ready='true';
    }
    // Firefox utilise le titre HTML comme nom proposé pour « Enregistrer en PDF ».
    // Le CIDR /24 reste visible dans le document, mais pas dans le nom de fichier.
    const normalTitle=document.title;
    document.title=current.base.address+'_VLSM';
    window.addEventListener('afterprint',()=>{
      document.title=normalTitle;
    },{once:true});
    try {
      window.print();
    } catch(error) {
      document.title=normalTitle;
      throw error;
    }
    return;
  }
  const flsm=Boolean(current.plan);
  $('pdf-a4-error').hidden=true;
  $('pdf-a4-title').textContent=flsm?'Fiche IPv4 et sous-réseaux FLSM':'Fiche d’adressage IPv4';
  $('pdf-a4-description').hidden=true;
  if(!flsm)$('pdf-a4-description').textContent='Choisir le document A4 portrait à télécharger :';
  $('pdf-a4-student').textContent=flsm?'Exercice A3 · Énoncé':'Fiche élève · Énoncé';
  $('pdf-a4-corrected').textContent=flsm?'Exercice A3 · Corrigé':'Fiche élève · Corrigé';
  $('pdf-a4-professional').hidden=false;
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
$('pdf-a4-professional').addEventListener('click',()=>{
  if(!current || current.protocol!=='ipv4')return;
  try {
    $('pdf-a4-error').hidden=true;
    $('pdf-a4-dialog').close();
    if(current.plan)printFlsmProfessional(current.base,current.plan);
    else printIPv4Professional(current.base);
  }catch(error){
    $('pdf-a4-error').textContent='Impossible de préparer le rapport professionnel : '+error.message;
    $('pdf-a4-error').hidden=false;
    $('pdf-a4-dialog').showModal();
  }
});
updatePdfAvailability();
