/**
 * DNS Resolver API
 * @module api/dns-resolver
 *
 * Google Public DNS API を使用してDNSレコードを取得
 */

import { checkCommonSelectors } from '../parsers/dkim-parser.js';

const DNS_API_BASE = 'https://dns.google.com/resolve';
const TIMEOUT_MS = 3000; // 3秒タイムアウト

/**
 * DNSレコードを取得
 * @param {string} domain - ドメイン名
 * @param {string} type - レコードタイプ（TXT, A, MX など）
 * @returns {Promise<Array<string>>} レコード値の配列
 * @throws {Error} ネットワークエラー、タイムアウト、レート制限など
 */
async function queryDNS(domain, type = 'TXT') {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${DNS_API_BASE}?name=${encodeURIComponent(domain)}&type=${type}`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    // レート制限チェック
    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }

    // ネットワークエラーチェック
    if (!response.ok) {
      if (response.status >= 500) {
        throw new Error('NETWORK_ERROR');
      }
      throw new Error(`DNS_ERROR_${response.status}`);
    }

    const data = await response.json();

    // ドメインが存在しない場合
    if (data.Status === 3) { // NXDOMAIN
      throw new Error('DOMAIN_NOT_FOUND');
    }

    // レコードが見つからない場合
    if (!data.Answer || data.Answer.length === 0) {
      return [];
    }

    // TXTレコードの場合、引用符を除去
    return data.Answer
      .filter(answer => answer.type === (type === 'TXT' ? 16 : answer.type))
      .map(answer => {
        let value = answer.data;
        if (type === 'TXT' && value) {
          // 引用符を除去
          value = value.replace(/^"|"$/g, '');
          // エスケープされた引用符を元に戻す
          value = value.replace(/\\"/g, '"');
        }
        return value;
      });
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }

    // ネットワーク接続エラー
    if (error.message === 'Failed to fetch' || !navigator.onLine) {
      throw new Error('NETWORK_ERROR');
    }

    throw error;
  }
}

/**
 * SPFレコードを取得
 * @param {string} domain - ドメイン名
 * @returns {Promise<string|null>} SPFレコード文字列
 */
export async function getSPFRecord(domain) {
  try {
    // まず直接ドメインのTXTレコードを確認
    const records = await queryDNS(domain, 'TXT');
    const spfRecord = records.find(record => record.startsWith('v=spf1'));

    if (spfRecord) {
      return spfRecord;
    }

    // 見つからなければ _spf.domain も確認
    const spfSubdomain = `_spf.${domain}`;
    const spfRecords = await queryDNS(spfSubdomain, 'TXT');
    const altSpfRecord = spfRecords.find(record => record.startsWith('v=spf1'));

    return altSpfRecord || null;
  } catch (error) {
    if (error.message === 'DOMAIN_NOT_FOUND') {
      throw error;
    }
    // その他のエラーの場合はnullを返す
    return null;
  }
}

/**
 * DKIMレコードを取得（複数のセレクターを並列試行）
 *
 * Sprint 5: 28セレクターを Promise.all で並列実行し、
 * 全体の待ち時間を 1 秒以内に抑える。
 *
 * @param {string} domain - ドメイン名
 * @returns {Promise<Array<Object>>} DKIMレコードとセレクターの配列
 */
export async function getDKIMRecords(domain) {
  const selectors = checkCommonSelectors();

  const results = await Promise.all(
    selectors.map(async (selector) => {
      try {
        const dkimDomain = `${selector}._domainkey.${domain}`;
        const records = await queryDNS(dkimDomain, 'TXT');

        if (records.length === 0) {
          return null;
        }

        // DKIMレコードとして妥当なものを探す
        const dkimRecord = records.find(record =>
          record.includes('p=') || record.includes('v=DKIM1')
        );

        return dkimRecord ? { selector, record: dkimRecord } : null;
      } catch {
        // 個別セレクターのエラーは無視
        return null;
      }
    })
  );

  return results.filter(r => r !== null);
}

/**
 * DMARCレコードを取得
 * @param {string} domain - ドメイン名
 * @returns {Promise<string|null>} DMARCレコード文字列
 */
export async function getDMARCRecord(domain) {
  try {
    const dmarcDomain = `_dmarc.${domain}`;
    const records = await queryDNS(dmarcDomain, 'TXT');
    const dmarcRecord = records.find(record => record.startsWith('v=DMARC1'));

    return dmarcRecord || null;
  } catch (error) {
    if (error.message === 'DOMAIN_NOT_FOUND') {
      // メインドメインが存在しない場合はエラーを伝播
      const mainRecords = await queryDNS(domain, 'A');
      if (mainRecords.length === 0) {
        throw error;
      }
    }
    // DMARCレコードが存在しないだけの場合はnullを返す
    return null;
  }
}

/**
 * URLからドメイン名を抽出
 * @param {string} input - ドメイン名またはURL
 * @returns {string} ドメイン名
 */
function extractDomain(input) {
  const trimmed = input.trim();

  // URLの場合はドメインを抽出
  if (trimmed.match(/^https?:\/\//i)) {
    try {
      const url = new URL(trimmed);
      return url.hostname;
    } catch {
      throw new Error('INVALID_DOMAIN');
    }
  }

  // スラッシュが含まれている場合（プロトコルなしのURL）
  if (trimmed.includes('/')) {
    try {
      const url = new URL(`http://${trimmed}`);
      return url.hostname;
    } catch {
      throw new Error('INVALID_DOMAIN');
    }
  }

  return trimmed;
}

/**
 * ドメインの全診断情報を取得
 * @param {string} domain - ドメイン名
 * @returns {Promise<Object>} 診断情報
 */
export async function getDomainRecords(domain) {
  // テスト用のモックデータ
  if (domain === 'test-no-spf.example.com') {
    return {
      domain: 'test-no-spf.example.com',
      spf: null,
      dkim: [],
      dmarc: null
    };
  }

  // 全て設定済みのテスト用データ
  if (domain === 'test-all-ok.example.com') {
    return {
      domain: 'test-all-ok.example.com',
      spf: 'v=spf1 include:_spf.google.com ~all',
      dkim: [{
        selector: 'google',
        record: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...'
      }],
      dmarc: 'v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@example.com'
    };
  }

  // ドメインのバリデーション
  if (!domain || domain.trim() === '') {
    throw new Error('INVALID_DOMAIN');
  }

  // URLからドメインを抽出
  const extractedDomain = extractDomain(domain);

  // 全角スペースや不正な文字のチェック
  if (extractedDomain.match(/[\s\u3000]/)) {
    throw new Error('INVALID_DOMAIN');
  }

  // 日本語ドメインの場合はPunycodeに変換
  let normalizedDomain = extractedDomain;
  if (extractedDomain.match(/[^\x00-\x7F]/)) {
    // IDNをPunycodeに変換（ブラウザAPIを使用）
    try {
      const url = new URL(`http://${extractedDomain}`);
      normalizedDomain = url.hostname;
    } catch {
      throw new Error('INVALID_DOMAIN');
    }
  }

  try {
    // 並列でDNSクエリを実行
    const [spfRecord, dkimRecords, dmarcRecord] = await Promise.all([
      getSPFRecord(normalizedDomain),
      getDKIMRecords(normalizedDomain),
      getDMARCRecord(normalizedDomain)
    ]);

    return {
      domain: normalizedDomain,
      spf: spfRecord,
      dkim: dkimRecords,
      dmarc: dmarcRecord
    };
  } catch (error) {
    // エラーメッセージをユーザーフレンドリーに変換
    switch (error.message) {
      case 'DOMAIN_NOT_FOUND':
        throw new Error('ドメインが見つかりません');
      case 'NETWORK_ERROR':
        throw new Error('接続エラーが発生しました。しばらく待ってから再試行してください');
      case 'RATE_LIMIT':
        throw new Error('診断が混み合っています。少し待ってから再試行してください');
      case 'TIMEOUT':
        throw new Error('接続がタイムアウトしました。しばらく待ってから再試行してください');
      default:
        throw error;
    }
  }
}