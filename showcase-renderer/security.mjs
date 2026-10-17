import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export function isPublicAddress(value) {
  try {
    const address = ipaddr.parse(value);
    if (address.kind() === 'ipv6' && address.isIPv4MappedAddress()) {
      return isPublicAddress(address.toIPv4Address().toString());
    }
    return address.range() === 'unicast';
  } catch {
    return false;
  }
}

export async function resolvePublicHttpsUrl(input, resolver = dns) {
  let url;
  try { url = new URL(input); } catch { throw new Error('A valid website URL is required.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('Only public HTTPS websites on the standard port are supported.');
  }
  if (!url.hostname || url.hostname.endsWith('.') || url.hostname.toLowerCase() === 'localhost') {
    throw new Error('The website hostname is not allowed.');
  }
  const literalFamily = ipaddr.isValid(url.hostname) ? ipaddr.parse(url.hostname).kind() : null;
  const addresses = literalFamily
    ? [{ address: url.hostname, family: literalFamily === 'ipv4' ? 4 : 6 }]
    : await resolver.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('The website resolves to a restricted or non-public network address.');
  }
  return { url, address: addresses[0].address, family: addresses[0].family };
}
