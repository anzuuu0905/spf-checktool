/**
 * テスト用モックDNSレゾルバー
 * 特定のドメインに対して完全に設定済みの結果を返す
 */

import { getDomainRecords as originalGetDomainRecords } from './dns-resolver.js';

// テスト用の完全設定済みドメイン
const FULLY_CONFIGURED_DOMAINS = {
  'perfect.example.com': {
    spf: 'v=spf1 include:_spf.google.com ~all',
    dkim: [
      { selector: 'google._domainkey', record: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFA...' },
      { selector: 'selector1._domainkey', record: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFA...' }
    ],
    dmarc: 'v=DMARC1; p=reject; pct=100; rua=mailto:dmarc@perfect.example.com'
  },
  'allgood.test.com': {
    spf: 'v=spf1 include:sendgrid.net include:_spf.google.com -all',
    dkim: [
      { selector: 'sendgrid._domainkey', record: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFA...' },
      { selector: 'google._domainkey', record: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFA...' }
    ],
    dmarc: 'v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@allgood.test.com; ruf=mailto:forensic@allgood.test.com'
  }
};

/**
 * モック対応版DNSレコード取得関数
 */
export async function getDomainRecordsWithMock(domain) {
  // テスト用ドメインの場合はモックデータを返す
  if (FULLY_CONFIGURED_DOMAINS[domain]) {
    console.log(`[Mock] Returning fully configured records for: ${domain}`);
    return FULLY_CONFIGURED_DOMAINS[domain];
  }

  // それ以外は通常のAPIを使用
  return originalGetDomainRecords(domain);
}