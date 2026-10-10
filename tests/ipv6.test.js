import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIPv6 } from '../js/ipv6.js';

test('IPv6 documentaire /64 : dernière adresse, 2^64, un seul /64', () => {
  const result=parseIPv6('2001:db8:abcd:12::1234/64');
  assert.equal(result.type,'Documentation IPv6');
  assert.equal(result.scope,'Réservée aux exemples ; non routable publiquement');
  assert.equal(result.network,'2001:db8:abcd:12::');
  assert.equal(result.lastAddress,'2001:db8:abcd:12:ffff:ffff:ffff:ffff');
  assert.equal(result.addressCount,'18446744073709551616');
  assert.equal(result.subnets64,'1');
});

test('Documentation 3fff::/20 et adresse unicast globale normale', () => {
  assert.equal(parseIPv6('3fff:0:1::2/48').type,'Documentation IPv6');
  assert.equal(parseIPv6('2001:4860:4860::8888/64').type,'Unicast globale (2000::/3)');
});

test('Le /56 contient 256 sous-réseaux /64', () => {
  const result=parseIPv6('fd12:3456::7/56');
  assert.equal(result.subnets64,'256');
  assert.equal(result.subnets64Exponent,8);
  assert.equal(result.lastAddress,'fd12:3456:0:ff:ffff:ffff:ffff:ffff');
});

test('Les préfixes plus spécifiques que /64 ne contiennent aucun /64 complet', () => {
  const result=parseIPv6('fe80::1/80');
  assert.equal(result.subnets64,'0');
  assert.equal(result.subnets64Exponent,null);
});

test('Adresse seule sans CIDR : /128 par défaut, capacité 1', () => {
  const result=parseIPv6('::1');
  assert.equal(result.assumedPrefix,true);
  assert.equal(result.prefix,128);
  assert.equal(result.lastAddress,'::1');
  assert.equal(result.addressCount,'1');
});

test('Bloc IPv6 complet /0 : arithmétique entière, aucune perte de précision', () => {
  const result=parseIPv6('::/0');
  assert.equal(result.lastAddress,'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff');
  assert.equal(result.addressCount,(1n<<128n).toString());
  assert.equal(result.subnets64,(1n<<64n).toString());
});

test('Les adresses invalides restent refusées', () => {
  assert.throws(()=>parseIPv6('2001:db8::1234/129'));
  assert.throws(()=>parseIPv6('2001:db8::gg/64'));
  assert.throws(()=>parseIPv6('1:2:3:4:5:6:7:8:9/64'));
});
