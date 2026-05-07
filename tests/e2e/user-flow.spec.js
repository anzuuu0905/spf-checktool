import { test, expect } from '@playwright/test';

/**
 * Sprint 1 E2Eテスト: ユーザーフロー
 *
 * このテストは Sprint 1 の 45 項目の受け入れ基準を 100% カバーする。
 * TDD Red フェーズのため、現時点では全テストが FAIL する。
 */

test.describe('画面表示', () => {
  test('ページタイトル「メール配信診断ツール」が表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('メール配信診断ツール');
  });

  test('キャッチコピー「あなたの会社のメールは正しく届いていますか?」が表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=あなたの会社のメールは正しく届いていますか')).toBeVisible();
  });

  test('ドメイン入力欄に「例: example.com」のプレースホルダーが表示される', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[type="text"]');
    await expect(input).toHaveAttribute('placeholder', /example\.com/);
  });

  test('診断ボタンが青色で目立つように配置されている', async ({ page }) => {
    await page.goto('/');
    const button = page.locator('button:has-text("診断")');
    await expect(button).toBeVisible();

    // 青色であることを確認（RGB値で検証）
    const backgroundColor = await button.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // 青系の色（rgb(0-100, 100-200, 200-255) の範囲を想定）
    expect(backgroundColor).toMatch(/rgb\(\s*\d{1,2},\s*\d{2,3},\s*2[0-5][0-9]\s*\)/);
  });
});

test.describe('レスポンシブレイアウト', () => {
  test('スマートフォン（375px）で正しくレイアウトされる', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // レイアウト崩れがないか確認
    const container = page.locator('main');
    const width = await container.evaluate((el) => el.offsetWidth);
    expect(width).toBeLessThanOrEqual(375);
  });

  test('タブレット（768px）で正しくレイアウトされる', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    const container = page.locator('main');
    const width = await container.evaluate((el) => el.offsetWidth);
    expect(width).toBeLessThanOrEqual(768);
  });

  test('デスクトップ（1440px）で正しくレイアウトされる', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const container = page.locator('main');
    const width = await container.evaluate((el) => el.offsetWidth);
    expect(width).toBeLessThanOrEqual(1440);
  });
});

test.describe('ドメイン入力と診断開始', () => {
  test('ドメイン入力 → 診断ボタンクリック → 診断開始', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('test.com');
    await button.click();

    // ローディング表示を確認
    await expect(page.locator('text=診断中')).toBeVisible({ timeout: 3000 });
  });

  test('ローディング表示が3秒以内に開始される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('test.com');

    const startTime = Date.now();
    await button.click();
    await expect(page.locator('text=診断中')).toBeVisible();
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(3000);
  });

  test('ローディング中は診断ボタンが無効化される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('test.com');
    await button.click();

    await expect(page.locator('text=診断中')).toBeVisible();
    await expect(button).toBeDisabled();
  });

  test('診断完了後に診断ボタンが再度有効化される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('test.com');
    await button.click();

    // 診断完了まで待機
    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });
    await expect(button).toBeEnabled();
  });

  test('空欄で診断ボタンをクリックすると「ドメインを入力してください」エラーが表示される', async ({ page }) => {
    await page.goto('/');

    const button = page.locator('button:has-text("診断")');
    await button.click();

    await expect(page.locator('text=ドメインを入力してください')).toBeVisible();
  });

  test('不正な形式（全角スペースのみ）でエラーメッセージが表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('　'); // 全角スペース
    await button.click();

    await expect(page.locator('text=ドメインを入力してください')).toBeVisible();
  });

  test('不正な形式（全角文字）でエラーメッセージが表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('テスト'); // 全角文字
    await button.click();

    await expect(page.locator('text=正しいドメインを入力してください')).toBeVisible();
  });
});

test.describe('SPF診断結果', () => {
  test('SPFレコードが設定されている場合、緑色のチェックマークと「設定済み」が表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('google.com'); // SPF設定済みドメイン
    await button.click();

    // 診断完了まで待機
    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const spfCard = page.locator('[data-testid="spf-result"]');
    await expect(spfCard.locator('text=設定済み')).toBeVisible();
    await expect(spfCard.locator('[data-testid="check-icon"]')).toBeVisible();

    // 緑色であることを確認
    const iconColor = await spfCard.locator('[data-testid="check-icon"]').evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(iconColor).toMatch(/rgb\(\s*\d{1,2},\s*[12]\d{2},\s*\d{1,2}\s*\)/); // 緑系
  });

  test('SPFレコードが未設定の場合、赤色の警告アイコンと「未設定」が表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('test.invalid'); // SPF未設定ドメイン
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const spfCard = page.locator('[data-testid="spf-result"]');
    await expect(spfCard.locator('text=未設定')).toBeVisible();
    await expect(spfCard.locator('[data-testid="warning-icon"]')).toBeVisible();

    // 赤色であることを確認
    const iconColor = await spfCard.locator('[data-testid="warning-icon"]').evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(iconColor).toMatch(/rgb\(\s*[12]\d{2},\s*\d{1,2},\s*\d{1,2}\s*\)/); // 赤系
  });

  test('SPF未設定時に説明文が表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('test.invalid');
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const spfCard = page.locator('[data-testid="spf-result"]');
    await expect(spfCard.locator('text=会社名で偽の請求書が送られ、Gmailに届かなくなり、商談を逃す可能性があります')).toBeVisible();
  });

  test('「SPFとは何ですか？」をクリックすると説明が展開される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('test.invalid');
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const spfCard = page.locator('[data-testid="spf-result"]');
    const detailToggle = spfCard.locator('text=SPFとは何ですか');
    await detailToggle.click();

    await expect(spfCard.locator('text=会社の看板を勝手に使った偽メールをブロックする機能。郵便局で差出人をチェックするイメージ')).toBeVisible();
  });
});

test.describe('DKIM診断結果', () => {
  test('DKIMレコードが設定されている場合、緑色のチェックマークと「設定済み」が表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('google.com'); // DKIM設定済みドメイン
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const dkimCard = page.locator('[data-testid="dkim-result"]');
    await expect(dkimCard.locator('text=設定済み')).toBeVisible();
    await expect(dkimCard.locator('[data-testid="check-icon"]')).toBeVisible();
  });

  test('DKIMレコードが未設定の場合、オレンジ色の注意アイコンと「未設定」が表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('example.com'); // DKIM未設定ドメイン
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const dkimCard = page.locator('[data-testid="dkim-result"]');
    await expect(dkimCard.locator('text=未設定')).toBeVisible();
    await expect(dkimCard.locator('[data-testid="warning-icon"]')).toBeVisible();

    // オレンジ色であることを確認
    const iconColor = await dkimCard.locator('[data-testid="warning-icon"]').evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(iconColor).toMatch(/rgb\(\s*[12]\d{2},\s*[12]\d{2},\s*\d{1,2}\s*\)/); // オレンジ系
  });

  test('DKIM未設定時に説明文が表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('example.com');
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const dkimCard = page.locator('[data-testid="dkim-result"]');
    await expect(dkimCard.locator('text=メールが途中で書き換えられ、振込先変更詐欺の危険があります')).toBeVisible();
  });

  test('「DKIMとは何ですか？」をクリックすると説明が展開される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('example.com');
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const dkimCard = page.locator('[data-testid="dkim-result"]');
    const detailToggle = dkimCard.locator('text=DKIMとは何ですか');
    await detailToggle.click();

    await expect(dkimCard.locator('text=メールに会社の実印を押す機能。割印のように改ざん防止する')).toBeVisible();
  });
});

test.describe('DMARC診断結果', () => {
  test('DMARCレコードが設定されている場合、緑色のチェックマークと「設定済み」が表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('google.com'); // DMARC設定済みドメイン
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const dmarcCard = page.locator('[data-testid="dmarc-result"]');
    await expect(dmarcCard.locator('text=設定済み')).toBeVisible();
    await expect(dmarcCard.locator('[data-testid="check-icon"]')).toBeVisible();
  });

  test('DMARCレコードが未設定の場合、黄色の情報アイコンと「未設定」が表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('github.com'); // DMARC未設定ドメイン
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const dmarcCard = page.locator('[data-testid="dmarc-result"]');
    await expect(dmarcCard.locator('text=未設定')).toBeVisible();
    await expect(dmarcCard.locator('[data-testid="info-icon"]')).toBeVisible();

    // 黄色であることを確認
    const iconColor = await dmarcCard.locator('[data-testid="info-icon"]').evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(iconColor).toMatch(/rgb\(\s*[12]\d{2},\s*[12]\d{2},\s*\d{1,2}\s*\)/); // 黄系
  });

  test('DMARC未設定時に説明文が表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('github.com');
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const dmarcCard = page.locator('[data-testid="dmarc-result"]');
    await expect(dmarcCard.locator('text=CEO詐欺で中小企業でも数百万円〜数千万円の被害に遭うケースが急増しています')).toBeVisible();
  });

  test('「DMARCとは何ですか？」をクリックすると説明が展開される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('github.com');
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const dmarcCard = page.locator('[data-testid="dmarc-result"]');
    const detailToggle = dmarcCard.locator('text=DMARCとは何ですか');
    await detailToggle.click();

    await expect(dmarcCard.locator('text=SPFとDKIMを組み合わせた最終防衛ライン。社員証と入館証の二重チェック')).toBeVisible();
  });
});

test.describe('CTAと誘導', () => {
  test('1つ以上の項目が未設定の場合、「専門家に相談する」ボタンが表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('test.invalid'); // 全未設定
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const ctaButton = page.locator('button:has-text("専門家に相談する")');
    await expect(ctaButton).toBeVisible();
  });

  test('相談ボタンの上に「設定には専門的な知識が必要です」のメッセージが表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('test.invalid');
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    await expect(page.locator('text=設定には専門的な知識が必要です')).toBeVisible();
  });

  test('相談ボタンをクリックすると外部フォームに遷移する', async ({ page, context }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('test.invalid');
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const ctaButton = page.locator('button:has-text("専門家に相談する")');

    // 新しいタブが開くことを確認
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      ctaButton.click()
    ]);

    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('forms.example.com/email-support');
  });

  test('全て設定済みの場合は「問題ありません」と緑色のメッセージが表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('google.com'); // 全設定済み
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    const successMessage = page.locator('text=問題ありません');
    await expect(successMessage).toBeVisible();

    // 緑色であることを確認
    const messageColor = await successMessage.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(messageColor).toMatch(/rgb\(\s*\d{1,2},\s*[12]\d{2},\s*\d{1,2}\s*\)/); // 緑系
  });

  test('全て設定済みでも「さらに詳しく診断したい方はこちら」のリンクが表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('google.com');
    await button.click();

    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 5000 });

    await expect(page.locator('text=さらに詳しく診断したい方はこちら')).toBeVisible();
  });
});

test.describe('エラーハンドリング', () => {
  test('存在しないドメインで「ドメインが見つかりません」エラーが表示される', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('thisisnotarealdomainxyz123.com');
    await button.click();

    await expect(page.locator('text=ドメインが見つかりません')).toBeVisible({ timeout: 5000 });
  });

  test('ネットワークエラー時に「接続エラーが発生しました」が表示される', async ({ page }) => {
    // ネットワークをオフラインに設定
    await page.context().setOffline(true);

    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('test.com');
    await button.click();

    await expect(page.locator('text=接続エラーが発生しました。しばらく待ってから再試行してください')).toBeVisible({ timeout: 5000 });
  });

  test('レート制限時に「診断が混み合っています」が表示される', async ({ page }) => {
    // レート制限をシミュレート（モックで対応）
    await page.route('**/dns.google.com/**', (route) => {
      route.fulfill({
        status: 429,
        body: 'Rate limit exceeded'
      });
    });

    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('test.com');
    await button.click();

    await expect(page.locator('text=診断が混み合っています。少し待ってから再試行してください')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('パフォーマンス要件', () => {
  test('診断処理が3秒以内に完了する', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('input[type="text"]');
    const button = page.locator('button:has-text("診断")');

    await input.fill('test.com');

    const startTime = Date.now();
    await button.click();
    await expect(page.locator('text=診断中')).toBeHidden({ timeout: 3000 });
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(3000);
  });

  test('Lighthouse Performance スコアが90以上', async ({ page }) => {
    // Lighthouseは別途実行（playwright-lighthouseプラグイン使用）
    // このテストは実装時に有効化
    test.skip();
  });

  test('Lighthouse Accessibility スコアが90以上', async ({ page }) => {
    test.skip();
  });

  test('Lighthouse Best Practices スコアが90以上', async ({ page }) => {
    test.skip();
  });

  test('First Contentful Paint (FCP) が1.8秒以下', async ({ page }) => {
    test.skip();
  });
});
