import { describe, test, expect } from 'vitest';
// import { diagnoseDKIM } from '../../../src/diagnosis/dkim-diagnosis';

/**
 * DKIM診断ロジック ユニットテスト
 *
 * TDD Red フェーズ: 実装コードが存在しないため、全テストがFAIL状態。
 * diagnoseDKIM 関数は src/diagnosis/dkim-diagnosis.js に実装予定。
 */

describe('DKIM診断ロジック', () => {
  test('DKIMレコードが存在する場合、「設定済み」を返す', () => {
    // const dkimRecord = {
    //   version: 'DKIM1',
    //   keyType: 'rsa',
    //   publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...',
    //   keyLength: 2048
    // };

    // const result = diagnoseDKIM(dkimRecord);
    // expect(result.status).toBe('configured');
    // expect(result.severity).toBe('success');
    // expect(result.icon).toBe('check');

    expect(true).toBe(false); // 実装後に削除
  });

  test('DKIMレコードが存在しない場合、「未設定」を返す', () => {
    // const result = diagnoseDKIM(null);
    // expect(result.status).toBe('not_configured');
    // expect(result.severity).toBe('warning'); // DKIMはオレンジ色の注意アイコン
    // expect(result.icon).toBe('warning');

    expect(true).toBe(false); // 実装後に削除
  });

  test('鍵長が2048bit未満の場合、「警告」を返す', () => {
    // const dkimRecord = {
    //   version: 'DKIM1',
    //   keyType: 'rsa',
    //   publicKey: 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...',
    //   keyLength: 1024
    // };

    // const result = diagnoseDKIM(dkimRecord);
    // expect(result.status).toBe('configured_weak');
    // expect(result.severity).toBe('warning');
    // expect(result.warningMessage).toBe('鍵長が2048bit未満です。より強固な鍵への移行を推奨します');

    expect(true).toBe(false); // 実装後に削除
  });

  test('DKIM未設定時の説明文が正しい', () => {
    // const result = diagnoseDKIM(null);
    // expect(result.description).toBe(
    //   'メールが途中で書き換えられ、振込先変更詐欺の危険があります'
    // );

    expect(true).toBe(false); // 実装後に削除
  });

  test('DKIM設定済み時の説明文が正しい', () => {
    // const dkimRecord = {
    //   version: 'DKIM1',
    //   keyType: 'rsa',
    //   publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...',
    //   keyLength: 2048
    // };

    // const result = diagnoseDKIM(dkimRecord);
    // expect(result.description).toBe(
    //   'デジタルの「会社印」をメールに押すことで、内容が少しでも書き換えられたら「偽物」とすぐにバレる仕組みです'
    // );

    expect(true).toBe(false); // 実装後に削除
  });

  test('「DKIMとは何ですか？」の詳細説明が正しい', () => {
    // const result = diagnoseDKIM(null);
    // expect(result.detailExplanation).toBe(
    //   'メールに会社の実印を押す機能。割印のように改ざん防止する'
    // );

    expect(true).toBe(false); // 実装後に削除
  });

  test('公開鍵が失効（p=空）している場合、「失効済み」を返す', () => {
    // const dkimRecord = {
    //   version: 'DKIM1',
    //   keyType: 'rsa',
    //   publicKey: '',
    //   isRevoked: true
    // };

    // const result = diagnoseDKIM(dkimRecord);
    // expect(result.status).toBe('revoked');
    // expect(result.severity).toBe('error');

    expect(true).toBe(false); // 実装後に削除
  });

  test('鍵長が2048bit以上の場合、「推奨」フラグが立つ', () => {
    // const dkimRecord = {
    //   version: 'DKIM1',
    //   keyType: 'rsa',
    //   publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...',
    //   keyLength: 2048
    // };

    // const result = diagnoseDKIM(dkimRecord);
    // expect(result.isRecommended).toBe(true);

    expect(true).toBe(false); // 実装後に削除
  });
});
