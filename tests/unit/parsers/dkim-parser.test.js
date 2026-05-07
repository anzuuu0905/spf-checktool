import { describe, test, expect } from 'vitest';
import { parseDKIMRecord, getKeyLength } from '../../../src/parsers/dkim-parser.js';

/**
 * DKIMパーサー ユニットテスト
 */

describe('DKIMパーサー', () => {
  test('正常なDKIMレコードをパースできる', () => {
    const dkimRecord = 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...';

    const result = parseDKIMRecord(dkimRecord);
    expect(result.version).toBe('DKIM1');
    expect(result.keyType).toBe('rsa');
    expect(result.publicKey).toBe('MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...');
    expect(result.keyLength).toBeTruthy();
  });

  test('DKIMレコードが存在しない場合、nullを返す', () => {
    const result = parseDKIMRecord(null);
    expect(result).toBeNull();
  });

  test('鍵長が2048bit以上の場合、推奨として判定される', () => {
    // 長い公開鍵（2048bit相当）
    const longKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA' + 'x'.repeat(300);
    const dkimRecord = `v=DKIM1; k=rsa; p=${longKey}`;

    const result = parseDKIMRecord(dkimRecord);
    expect(result.keyLength).toBeGreaterThanOrEqual(2048);
  });

  test('鍵長が2048bit未満の場合、警告対象となる', () => {
    // 短い公開鍵（1024bit相当）
    const shortKey = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC';
    const dkimRecord = `v=DKIM1; k=rsa; p=${shortKey}`;

    const result = parseDKIMRecord(dkimRecord);
    expect(result.keyLength).toBeLessThan(2048);
  });

  test('k=rsaタグを正しく抽出できる', () => {
    const dkimRecord = 'v=DKIM1; k=rsa; p=MIGfMA0GCS';

    const result = parseDKIMRecord(dkimRecord);
    expect(result.keyType).toBe('rsa');
  });

  test('p=の公開鍵を正しく抽出できる', () => {
    const publicKey = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC';
    const dkimRecord = `v=DKIM1; k=rsa; p=${publicKey}`;

    const result = parseDKIMRecord(dkimRecord);
    expect(result.publicKey).toBe(publicKey);
  });

  test('公開鍵がない場合、nullを返す', () => {
    const dkimRecord = 'v=DKIM1; k=rsa';

    const result = parseDKIMRecord(dkimRecord);
    expect(result).toBeNull();
  });

  test('セミコロンやカンマ区切りを正しく処理できる', () => {
    const dkimRecord = 'v=DKIM1, k=rsa, p=MIGfMA0GCS';

    const result = parseDKIMRecord(dkimRecord);
    expect(result.version).toBe('DKIM1');
    expect(result.keyType).toBe('rsa');
  });

  test('getKeyLength関数が鍵長を正しく返す', () => {
    const longKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA' + 'x'.repeat(300);
    const dkimRecord = `v=DKIM1; k=rsa; p=${longKey}`;
    const parsed = parseDKIMRecord(dkimRecord);

    const keyLength = getKeyLength(parsed);
    expect(keyLength).toBeGreaterThanOrEqual(2048);
  });
});