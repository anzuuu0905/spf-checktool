import { describe, test, expect } from 'vitest';
import { parseDMARCRecord, getPolicy, getRUA } from '../../../src/parsers/dmarc-parser.js';

/**
 * DMARCパーサー ユニットテスト
 */

describe('DMARCパーサー', () => {
  test('正常なDMARCレコードをパースできる', () => {
    const dmarcRecord = 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com';

    const result = parseDMARCRecord(dmarcRecord);
    expect(result.version).toBe('DMARC1');
    expect(result.policy).toBe('quarantine');
    expect(result.rua).toBe('mailto:dmarc@example.com');
    expect(result.percentage).toBe(100);
  });

  test('DMARCレコードが存在しない場合、nullを返す', () => {
    const result = parseDMARCRecord(null);
    expect(result).toBeNull();
  });

  test('ポリシー（p=none）を正しく抽出できる', () => {
    const dmarcRecord = 'v=DMARC1; p=none; rua=mailto:dmarc@example.com';

    const result = parseDMARCRecord(dmarcRecord);
    expect(result.policy).toBe('none');
  });

  test('ポリシー（p=quarantine）を正しく抽出できる', () => {
    const dmarcRecord = 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com';

    const result = parseDMARCRecord(dmarcRecord);
    expect(result.policy).toBe('quarantine');
  });

  test('ポリシー（p=reject）を正しく抽出できる', () => {
    const dmarcRecord = 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com';

    const result = parseDMARCRecord(dmarcRecord);
    expect(result.policy).toBe('reject');
  });

  test('rua（集約レポート送信先）を正しく抽出できる', () => {
    const dmarcRecord = 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com';

    const result = parseDMARCRecord(dmarcRecord);
    expect(result.rua).toBe('mailto:dmarc@example.com');
  });

  test('ruf（詳細レポート送信先）を正しく抽出できる', () => {
    const dmarcRecord = 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; ruf=mailto:forensic@example.com';

    const result = parseDMARCRecord(dmarcRecord);
    expect(result.ruf).toBe('mailto:forensic@example.com');
  });

  test('pct（適用率）を正しく抽出できる', () => {
    const dmarcRecord = 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; pct=50';

    const result = parseDMARCRecord(dmarcRecord);
    expect(result.percentage).toBe(50);
  });

  test('pctが省略されている場合、デフォルト100を返す', () => {
    const dmarcRecord = 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com';

    const result = parseDMARCRecord(dmarcRecord);
    expect(result.percentage).toBe(100);
  });

  test('バージョン（v=DMARC1）が存在しない場合、nullを返す', () => {
    const dmarcRecord = 'p=quarantine; rua=mailto:dmarc@example.com'; // v=DMARC1 が欠けている

    const result = parseDMARCRecord(dmarcRecord);
    expect(result).toBeNull();
  });

  test('ポリシー（p=）が存在しない場合、nullを返す', () => {
    const dmarcRecord = 'v=DMARC1; rua=mailto:dmarc@example.com'; // p= が欠けている

    const result = parseDMARCRecord(dmarcRecord);
    expect(result).toBeNull();
  });

  test('sp（サブドメインポリシー）を正しく抽出できる', () => {
    const dmarcRecord = 'v=DMARC1; p=quarantine; sp=reject; rua=mailto:dmarc@example.com';

    const result = parseDMARCRecord(dmarcRecord);
    expect(result.subdomainPolicy).toBe('reject');
  });
});
