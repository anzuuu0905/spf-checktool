import { describe, test, expect, vi } from 'vitest';
// import { resolveDNS } from '../../../src/api/dns-resolver';

/**
 * DNS Resolver ユニットテスト
 *
 * TDD Red フェーズ: 実装コードが存在しないため、全テストがFAIL状態。
 * resolveDNS 関数は src/api/dns-resolver.js に実装予定。
 *
 * Google Public DNS API (dns.google.com) を使用する想定。
 * テストではモックを使用してネットワーク呼び出しを回避する。
 */

describe('DNS Resolver', () => {
  test('Google Public DNS API 呼び出しが成功する（モック）', async () => {
    // global.fetch = vi.fn(() =>
    //   Promise.resolve({
    //     ok: true,
    //     json: () =>
    //       Promise.resolve({
    //         Answer: [
    //           {
    //             name: 'example.com.',
    //             type: 16, // TXT
    //             data: '"v=spf1 include:_spf.google.com ~all"'
    //           }
    //         ]
    //       })
    //   })
    // );

    // const result = await resolveDNS('example.com', 'TXT');
    // expect(result).toEqual([
    //   {
    //     name: 'example.com.',
    //     type: 16,
    //     data: '"v=spf1 include:_spf.google.com ~all"'
    //   }
    // ]);

    expect(true).toBe(false); // 実装後に削除
  });

  test('ネットワークエラー時に適切なエラーをスローする', async () => {
    // global.fetch = vi.fn(() =>
    //   Promise.reject(new Error('Network error'))
    // );

    // await expect(resolveDNS('example.com', 'TXT')).rejects.toThrow(
    //   '接続エラーが発生しました。しばらく待ってから再試行してください'
    // );

    expect(true).toBe(false); // 実装後に削除
  });

  test('レート制限時（429）に適切なエラーをスローする', async () => {
    // global.fetch = vi.fn(() =>
    //   Promise.resolve({
    //     ok: false,
    //     status: 429,
    //     statusText: 'Too Many Requests'
    //   })
    // );

    // await expect(resolveDNS('example.com', 'TXT')).rejects.toThrow(
    //   '診断が混み合っています。少し待ってから再試行してください'
    // );

    expect(true).toBe(false); // 実装後に削除
  });

  test('タイムアウト（3秒）時に適切なエラーをスローする', async () => {
    // global.fetch = vi.fn(
    //   () =>
    //     new Promise((resolve) =>
    //       setTimeout(() => resolve({ ok: true, json: () => ({}) }), 5000)
    //     )
    // );

    // await expect(resolveDNS('example.com', 'TXT', { timeout: 3000 })).rejects.toThrow(
    //   'タイムアウトしました'
    // );

    expect(true).toBe(false); // 実装後に削除
  });

  test('存在しないドメインで空の結果を返す', async () => {
    // global.fetch = vi.fn(() =>
    //   Promise.resolve({
    //     ok: true,
    //     json: () => Promise.resolve({ Answer: [] })
    //   })
    // );

    // const result = await resolveDNS('thisisnotarealdomainxyz123.com', 'TXT');
    // expect(result).toEqual([]);

    expect(true).toBe(false); // 実装後に削除
  });

  test('SPFレコードを正しく取得できる', async () => {
    // global.fetch = vi.fn(() =>
    //   Promise.resolve({
    //     ok: true,
    //     json: () =>
    //       Promise.resolve({
    //         Answer: [
    //           {
    //             name: 'example.com.',
    //             type: 16,
    //             data: '"v=spf1 include:_spf.google.com ~all"'
    //           }
    //         ]
    //       })
    //   })
    // );

    // const result = await resolveDNS('example.com', 'TXT');
    // const spfRecord = result.find((r) => r.data.includes('v=spf1'));
    // expect(spfRecord).toBeDefined();
    // expect(spfRecord.data).toContain('v=spf1');

    expect(true).toBe(false); // 実装後に削除
  });

  test('DKIMレコードを正しく取得できる', async () => {
    // global.fetch = vi.fn(() =>
    //   Promise.resolve({
    //     ok: true,
    //     json: () =>
    //       Promise.resolve({
    //         Answer: [
    //           {
    //             name: 'default._domainkey.example.com.',
    //             type: 16,
    //             data: '"v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC..."'
    //           }
    //         ]
    //       })
    //   })
    // );

    // const result = await resolveDNS('default._domainkey.example.com', 'TXT');
    // const dkimRecord = result.find((r) => r.data.includes('v=DKIM1'));
    // expect(dkimRecord).toBeDefined();
    // expect(dkimRecord.data).toContain('v=DKIM1');

    expect(true).toBe(false); // 実装後に削除
  });

  test('DMARCレコードを正しく取得できる', async () => {
    // global.fetch = vi.fn(() =>
    //   Promise.resolve({
    //     ok: true,
    //     json: () =>
    //       Promise.resolve({
    //         Answer: [
    //           {
    //             name: '_dmarc.example.com.',
    //             type: 16,
    //             data: '"v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"'
    //           }
    //         ]
    //       })
    //   })
    // );

    // const result = await resolveDNS('_dmarc.example.com', 'TXT');
    // const dmarcRecord = result.find((r) => r.data.includes('v=DMARC1'));
    // expect(dmarcRecord).toBeDefined();
    // expect(dmarcRecord.data).toContain('v=DMARC1');

    expect(true).toBe(false); // 実装後に削除
  });

  test('API URLが正しく構築される', async () => {
    // const mockFetch = vi.fn(() =>
    //   Promise.resolve({
    //     ok: true,
    //     json: () => Promise.resolve({ Answer: [] })
    //   })
    // );
    // global.fetch = mockFetch;

    // await resolveDNS('example.com', 'TXT');

    // expect(mockFetch).toHaveBeenCalledWith(
    //   'https://dns.google.com/resolve?name=example.com&type=TXT',
    //   expect.any(Object)
    // );

    expect(true).toBe(false); // 実装後に削除
  });
});
