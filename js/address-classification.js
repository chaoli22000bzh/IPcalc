/** Classification neutre de l'adresse d'une machine IPv4 (non du réseau calculé). */
import { ipv4ToNumber } from './ipv4.js';
const within=(n,base,bits)=>bits===0||Math.floor(n/2**(32-bits))===Math.floor(ipv4ToNumber(base)/2**(32-bits));
const special=(type,description)=>({category:'special',type,label:'Spéciale',description});
export function classifyIPv4(address){
  const text=String(address).trim().split('/')[0],n=ipv4ToNumber(text);
  if(within(n,'10.0.0.0',8)||within(n,'172.16.0.0',12)||within(n,'192.168.0.0',16))
    return {category:'lan',type:'private',label:'LAN',description:'Adresse privée RFC 1918, destinée aux réseaux locaux. Elle n’est pas directement routable sur Internet.'};
  if(within(n,'0.0.0.0',8))return special('this-network','Plage 0.0.0.0/8 réservée à des usages particuliers. Ne pas attribuer comme adresse ordinaire d’un équipement.');
  if(within(n,'127.0.0.0',8))return special('loopback','Adresse de bouclage : elle désigne la machine elle-même, et ne circule pas sur le LAN.');
  if(within(n,'169.254.0.0',16))return special('link-local','Adresse link-local (APIPA). Elle reste sur le lien local. Si elle est inattendue, vérifier notamment le DHCP.');
  if(within(n,'100.64.0.0',10))return special('shared','Adresse partagée (100.64.0.0/10), notamment utilisée par les opérateurs pour le CGNAT. Ce n’est pas une plage privée RFC 1918.');
  if(within(n,'192.0.0.0',24))return special('protocol-assignment','Plage 192.0.0.0/24 réservée à des usages de protocole (avec exceptions). Ne pas l’attribuer arbitrairement à un LAN.');
  if(within(n,'192.0.2.0',24)||within(n,'198.51.100.0',24)||within(n,'203.0.113.0',24))
    return special('documentation','Adresse TEST-NET réservée aux exemples, exercices et documentations. Ne pas l’utiliser pour un équipement réel.');
  if(within(n,'198.18.0.0',15))return special('benchmark','Adresse réservée aux essais de performance entre équipements réseau (198.18.0.0/15).');
  if(within(n,'192.88.99.0',24))return special('6to4','Plage historiquement utilisée pour les relais 6to4 et désormais dépréciée.');
  if(within(n,'224.0.0.0',4))return special('multicast','Adresse multicast : elle désigne un groupe de récepteurs, pas une machine unicast classique.');
  if(within(n,'240.0.0.0',4))return special('reserved','Adresse de l’espace réservé 240.0.0.0/4, non adaptée à l’adressage classique d’une machine.');
  return {category:'internet',type:'global',label:'Internet',description:'Adresse IPv4 de l’espace public. Elle ne doit pas être attribuée arbitrairement à un équipement d’un LAN : utiliser un bloc légitimement attribué.'};
}
