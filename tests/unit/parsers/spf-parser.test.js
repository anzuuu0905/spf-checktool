import { describe, test, expect } from 'vitest';
import { parseSPFRecord } from '../../../src/parsers/spf-parser.js';

/**
 * SPFパーサー ユニットテスト
 */

describe('SPFパーサー', () => {
  test('正常なSPFレコードをパースできる', () => {
    const spfRecord = 'v=spf1 include:_spf.google.com ~all';

    const result = parseSPFRecord(spfRecord);
    expect(result).toEqual({
      version: 'spf1',
      mechanisms: [
        { type: 'include', value: '_spf.google.com' }
      ],
      qualifier: '~all'
    });
  });

  test('SPFレコードが存在しない場合、nullを返す', () => {
    const result = parseSPFRecord(null);
    expect(result).toBeNull();
  });

  test('不正なSPFレコード（バージョンなし）でエラー', () => {
    const spfRecord = 'include:_spf.google.com ~all'; // v=spf1 が欠けている

    expect(() => {
      parseSPFRecord(spfRecord);
    }).toThrow('Invalid SPF record: version missing');
  });

  test('includeメカニズムを抽出できる', () => {
    const spfRecord = 'v=spf1 include:_spf.google.com include:_spf.salesforce.com ~all';

    const result = parseSPFRecord(spfRecord);
    expect(result.mechanisms).toHaveLength(2);
    expect(result.mechanisms[0]).toEqual({ type: 'include', value: '_spf.google.com' });
    expect(result.mechanisms[1]).toEqual({ type: 'include', value: '_spf.salesforce.com' });
  });

  test('ip4メカニズムを抽出できる', () => {
    const spfRecord = 'v=spf1 ip4:192.0.2.0/24 ~all';

    const result = parseSPFRecord(spfRecord);
    expect(result.mechanisms[0]).toEqual({ type: 'ip4', value: '192.0.2.0/24' });
  });

  test('ip6メカニズムを抽出できる', () => {
    const spfRecord = 'v=spf1 ip6:2001:db8::/32 ~all';

    const result = parseSPFRecord(spfRecord);
    expect(result.mechanisms[0]).toEqual({ type: 'ip6', value: '2001:db8::/32' });
  });

  test('qualifier (~all / -all / +all) を識別できる', () => {
    const spfRecord1 = 'v=spf1 include:_spf.google.com ~all';
    const spfRecord2 = 'v=spf1 include:_spf.google.com -all';
    const spfRecord3 = 'v=spf1 include:_spf.google.com +all';

    expect(parseSPFRecord(spfRecord1).qualifier).toBe('~all'); // SoftFail
    expect(parseSPFRecord(spfRecord2).qualifier).toBe('-all'); // Fail
    expect(parseSPFRecord(spfRecord3).qualifier).toBe('+all'); // Pass
  });

  test('aメカニズムを抽出できる', () => {
    const spfRecord = 'v=spf1 a:mail.example.com ~all';

    const result = parseSPFRecord(spfRecord);
    expect(result.mechanisms[0]).toEqual({ type: 'a', value: 'mail.example.com' });
  });

  test('mxメカニズムを抽出できる', () => {
    const spfRecord = 'v=spf1 mx:example.com ~all';

    const result = parseSPFRecord(spfRecord);
    expect(result.mechanisms[0]).toEqual({ type: 'mx', value: 'example.com' });
  });

  test('複数のメカニズムを組み合わせてパースできる', () => {
    const spfRecord = 'v=spf1 a mx include:_spf.google.com ip4:192.0.2.0/24 -all';

    const result = parseSPFRecord(spfRecord);
    expect(result.mechanisms).toHaveLength(4);
    expect(result.mechanisms[0]).toEqual({ type: 'a', value: null });
    expect(result.mechanisms[1]).toEqual({ type: 'mx', value: null });
    expect(result.mechanisms[2]).toEqual({ type: 'include', value: '_spf.google.com' });
    expect(result.mechanisms[3]).toEqual({ type: 'ip4', value: '192.0.2.0/24' });
    expect(result.qualifier).toBe('-all');
  });
});
