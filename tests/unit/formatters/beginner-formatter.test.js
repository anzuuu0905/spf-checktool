import { describe, test, expect } from 'vitest';
// import { formatBeginnerExplanation } from '../../../src/formatters/beginner-formatter';

/**
 * 初心者向けフォーマッター ユニットテスト
 *
 * TDD Red フェーズ: 実装コードが存在しないため、全テストがFAIL状態。
 * formatBeginnerExplanation 関数は src/formatters/beginner-formatter.js に実装予定。
 *
 * このテストは /docs/beginner-explanations.md の内容と厳密に一致することを保証する。
 */

describe('初心者向けフォーマッター', () => {
  test('SPF説明文が /docs/beginner-explanations.md と一致する', () => {
    // const explanation = formatBeginnerExplanation('spf', 'not_configured');

    // expect(explanation.title).toBe('SPF（差出人チェック機能）');
    // expect(explanation.oneLine).toBe(
    //   '会社の看板を勝手に使った偽メールをブロックする「差出人チェック機能」'
    // );
    // expect(explanation.notConfiguredRisk).toBe(
    //   'あなたの会社名で偽の請求書メールが取引先に届き、信用を失います。さらにGmailやOutlookがあなたのメールを「迷惑メール」と判定し、取引先に届かなくなり、大切な商談を逃す可能性があります。'
    // );
    // expect(explanation.configuredBenefit).toBe(
    //   '「この会社からのメールは、必ずこの郵便局から送られる」という証明書を作ることで、偽物を自動的にブロックできます。取引先から「この会社はセキュリティがしっかりしている」と信頼され、安心してメールのやり取りができます。'
    // );
    // expect(explanation.analogy).toBe(
    //   '会社の受付に「うちの社員リスト」を渡しておき、名刺を出した人が本当に社員かチェックしてもらうようなものです。'
    // );

    expect(true).toBe(false); // 実装後に削除
  });

  test('DKIM説明文が /docs/beginner-explanations.md と一致する', () => {
    // const explanation = formatBeginnerExplanation('dkim', 'not_configured');

    // expect(explanation.title).toBe('DKIM（会社の実印機能）');
    // expect(explanation.oneLine).toBe(
    //   'メールに「会社の実印」を押して、本物であることを証明する機能'
    // );
    // expect(explanation.notConfiguredRisk).toBe(
    //   'メールが途中で書き換えられても気づかれず、「振込先を変更しました」という偽の内容に改ざんされる危険があります。'
    // );
    // expect(explanation.configuredBenefit).toBe(
    //   'デジタルの「会社印」をメールに押すことで、内容が少しでも書き換えられたら「偽物」とすぐにバレる仕組みです。大手企業との取引でも「この会社は信頼できる」と認められます。'
    // );
    // expect(explanation.analogy).toBe(
    //   '重要書類に割印を押すように、メール全体に「改ざん防止シール」を貼るイメージです。'
    // );

    expect(true).toBe(false); // 実装後に削除
  });

  test('DMARC説明文が /docs/beginner-explanations.md と一致する', () => {
    // const explanation = formatBeginnerExplanation('dmarc', 'not_configured');

    // expect(explanation.title).toBe('DMARC（最終防衛ライン）');
    // expect(explanation.oneLine).toBe(
    //   'SPFとDKIMの2つの機能を組み合わせて、偽メールを完全シャットアウトする「最終防衛ライン」'
    // );
    // expect(explanation.notConfiguredRisk).toBe(
    //   'SPFやDKIMでチェックしても、すり抜ける巧妙な偽メールがあり、社長なりすまし詐欺（CEO詐欺）で、中小企業でも数百万円〜数千万円の被害に遭うケースが急増しています。'
    // );
    // expect(explanation.configuredBenefit).toBe(
    //   '「偽物と判定されたメールは必ず迷惑メールへ」「または完全に受信拒否」という厳格なルールを設定でき、なりすましを徹底的に防げます。取引先からの信頼も高まります。'
    // );
    // expect(explanation.analogy).toBe(
    //   '警備員が「社員証」と「入館証」の両方をチェックし、どちらか一つでも怪しければ絶対に中に入れない、という二重セキュリティゲートです。'
    // );

    expect(true).toBe(false); // 実装後に削除
  });

  test('「SPFとは何ですか？」の詳細説明が正しい', () => {
    // const detail = formatBeginnerExplanation('spf', 'not_configured', { includeDetail: true });

    // expect(detail.detailExplanation).toBe(
    //   '会社の看板を勝手に使った偽メールをブロックする機能。郵便局で差出人をチェックするイメージ'
    // );

    expect(true).toBe(false); // 実装後に削除
  });

  test('「DKIMとは何ですか？」の詳細説明が正しい', () => {
    // const detail = formatBeginnerExplanation('dkim', 'not_configured', { includeDetail: true });

    // expect(detail.detailExplanation).toBe(
    //   'メールに会社の実印を押す機能。割印のように改ざん防止する'
    // );

    expect(true).toBe(false); // 実装後に削除
  });

  test('「DMARCとは何ですか？」の詳細説明が正しい', () => {
    // const detail = formatBeginnerExplanation('dmarc', 'not_configured', { includeDetail: true });

    // expect(detail.detailExplanation).toBe(
    //   'SPFとDKIMを組み合わせた最終防衛ライン。社員証と入館証の二重チェック'
    // );

    expect(true).toBe(false); // 実装後に削除
  });

  test('設定済みの場合、リスク説明ではなくメリット説明を返す', () => {
    // const explanation = formatBeginnerExplanation('spf', 'configured');

    // expect(explanation.displayText).toBe(explanation.configuredBenefit);
    // expect(explanation.displayText).not.toBe(explanation.notConfiguredRisk);

    expect(true).toBe(false); // 実装後に削除
  });

  test('未設定の場合、メリット説明ではなくリスク説明を返す', () => {
    // const explanation = formatBeginnerExplanation('spf', 'not_configured');

    // expect(explanation.displayText).toBe(explanation.notConfiguredRisk);
    // expect(explanation.displayText).not.toBe(explanation.configuredBenefit);

    expect(true).toBe(false); // 実装後に削除
  });
});
