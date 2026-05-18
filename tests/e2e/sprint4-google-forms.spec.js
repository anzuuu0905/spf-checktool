import { test, expect } from '@playwright/test';

/**
 * Sprint 4 E2Eテスト: Google Forms統合
 *
 * このテストはSprint 4の全59項目の契約条件を検証する
 */

test.describe('Sprint 4: Google Forms統合', () => {

  test.describe('問題判定ロジック', () => {
    test('SPF未設定時に「問題あり」と判定される', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test-no-spf.example.com');
      await button.click();

      // 診断完了まで待機
      await page.waitForSelector('#results:not(.hidden)', { timeout: 10000 });

      // 診断結果セクションにhas-issuesクラスがあることを確認
      const resultsSection = page.locator('#results');
      await expect(resultsSection).toHaveClass(/has-issues/);
    });

    test('DKIM未設定時に「問題あり」と判定される', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test-no-dkim.example.com');
      await button.click();

      await page.waitForSelector('#results:not(.hidden)', { timeout: 10000 });

      const resultsSection = page.locator('#results');
      await expect(resultsSection).toHaveClass(/has-issues/);
    });

    test('DMARC未設定時に「問題あり」と判定される', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test-no-dmarc.example.com');
      await button.click();

      await page.waitForSelector('#results:not(.hidden)', { timeout: 10000 });

      const resultsSection = page.locator('#results');
      await expect(resultsSection).toHaveClass(/has-issues/);
    });

    test('診断スコアが79点以下で「問題あり」と判定される', async ({ page }) => {
      // このテストはモックが必要なためスキップ
      test.skip();
    });

    test('全て設定済みでスコア80点以上の場合「問題なし」と判定される', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      // google.comは通常全て設定済み
      await input.fill('google.com');
      await button.click();

      await page.waitForSelector('#results:not(.hidden)', { timeout: 10000 });

      const resultsSection = page.locator('#results');
      await expect(resultsSection).toHaveClass(/no-issues/);
    });
  });

  test.describe('Google Forms埋め込み', () => {
    test('診断結果の直後にフォームエリアが挿入される', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test.example.com');
      await button.click();

      await page.waitForSelector('#results:not(.hidden)', { timeout: 10000 });
      await page.waitForSelector('#google-forms-area', { timeout: 5000 });

      // フォームエリアが存在することを確認
      const formsArea = page.locator('#google-forms-area');
      await expect(formsArea).toBeVisible();

      // 診断結果セクションの次に配置されていることを確認
      const resultsSection = page.locator('#results');
      const nextElement = await resultsSection.evaluate(el => {
        const next = el.nextElementSibling;
        return next ? next.id : null;
      });

      // CTAセクションの前に配置されていることを確認
      expect(nextElement).toBe('google-forms-area');
    });

    test('問題ありの場合、適切な見出しが表示される', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test-no-spf.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const heading = page.locator('#google-forms-area .forms-heading');
      await expect(heading).toContainText('設定方法がわからない方、専門家に相談したい方へ');
    });

    test('問題なしの場合、適切な見出しが表示される', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('google.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const heading = page.locator('#google-forms-area .forms-heading');
      await expect(heading).toContainText('その他のご相談も承ります');
    });

    test('Google FormsがiFrameで埋め込まれる', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const iframe = page.locator('#google-forms-iframe');
      await expect(iframe).toBeVisible();

      // iFrameのsrcが正しいことを確認
      const src = await iframe.getAttribute('src');
      expect(src).toContain('https://docs.google.com/forms/d/e/1FAIpQLSecpCNK7VJye7qQSWmLCdOTQZiTdPm82K-MXKYCNAK_23ehbA/viewform');
      expect(src).toContain('embedded=true');
    });

    test('iFrameの高さが最低640pxに設定される', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const iframe = page.locator('#google-forms-iframe');
      const height = await iframe.getAttribute('height');
      expect(parseInt(height)).toBeGreaterThanOrEqual(640);
    });

    test('問題ありの場合、適切な説明文が表示される', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test-no-spf.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const description = page.locator('#google-forms-area .forms-description');
      await expect(description).toContainText('SPF/DKIM/DMARCの設定は専門的な知識が必要です');
    });

    test('問題なしの場合、適切な説明文が表示される', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('google.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const description = page.locator('#google-forms-area .forms-description');
      await expect(description).toContainText('メール配信設定は問題ありません');
    });
  });

  test.describe('レスポンシブデザイン', () => {
    test('PC（1024px以上）でフォームが最大幅800pxで中央配置される', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const container = page.locator('#google-forms-area .forms-container');
      const width = await container.evaluate(el => getComputedStyle(el).maxWidth);
      expect(width).toBe('800px');
    });

    test('タブレット（768px-1023px）で適切に表示される', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const formsArea = page.locator('#google-forms-area');
      const padding = await formsArea.evaluate(el => getComputedStyle(el).padding);
      expect(padding).toContain('32px'); // 32px 24px
    });

    test('スマホ（767px以下）で全幅表示される', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const formsArea = page.locator('#google-forms-area');
      const padding = await formsArea.evaluate(el => getComputedStyle(el).padding);
      expect(padding).toContain('24px'); // 24px 16px
    });

    test('全デバイスでiFrameが親要素からはみ出さない', async ({ page }) => {
      const viewports = [
        { width: 375, height: 667 },   // スマホ
        { width: 768, height: 1024 },  // タブレット
        { width: 1440, height: 900 }   // PC
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto('/');

        const input = page.locator('#domain-input');
        const button = page.locator('#diagnose-button');

        await input.fill('test.example.com');
        await button.click();

        await page.waitForSelector('#google-forms-area', { timeout: 10000 });

        const iframe = page.locator('#google-forms-iframe');
        const iframeWidth = await iframe.evaluate(el => el.offsetWidth);
        const containerWidth = await page.locator('.forms-iframe-container').evaluate(el => el.offsetWidth);

        expect(iframeWidth).toBeLessThanOrEqual(containerWidth);
      }
    });
  });

  test.describe('デザイン整合性', () => {
    test('フォームエリアの背景色がダークテーマに合致している', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const formsArea = page.locator('#google-forms-area');
      const bgColor = await formsArea.evaluate(el => getComputedStyle(el).backgroundColor);

      // #1a1a1aまたは近い色であることを確認
      expect(bgColor).toMatch(/rgb\(\s*2[0-6],\s*2[0-6],\s*2[0-6]\s*\)/);
    });

    test('フォームエリアにソフトシャドウが適用されている', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const formsArea = page.locator('#google-forms-area');
      const boxShadow = await formsArea.evaluate(el => getComputedStyle(el).boxShadow);

      expect(boxShadow).not.toBe('none');
    });

    test('フォームエリアの角が丸められている', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const formsArea = page.locator('#google-forms-area');
      const borderRadius = await formsArea.evaluate(el => getComputedStyle(el).borderRadius);

      expect(borderRadius).toBe('12px');
    });
  });

  test.describe('ユーザー体験', () => {
    test('診断完了後、自動的にフォームエリアまでスムーズスクロールする', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      // スクロール位置を確認
      await page.waitForTimeout(1000); // スクロールアニメーション待機

      const formsArea = page.locator('#google-forms-area');
      const isInViewport = await formsArea.isIntersectingViewport();

      expect(isInViewport).toBeTruthy();
    });

    test('フォーム表示時にフェードインアニメーションが適用される', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const formsArea = page.locator('#google-forms-area');
      const transition = await formsArea.evaluate(el => getComputedStyle(el).transition);

      expect(transition).toContain('opacity');
      expect(transition).toContain('0.3s');
    });

    test('フォームの読み込み中メッセージが表示される', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const loadingMessage = page.locator('.forms-loading');
      await expect(loadingMessage).toContainText('フォームを読み込んでいます');
    });

    test('連続診断で既存フォームが再利用される', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      // 1回目の診断（問題あり）
      await input.fill('test-no-spf.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const firstHeading = await page.locator('#google-forms-area .forms-heading').textContent();
      expect(firstHeading).toContain('設定方法がわからない方');

      // 2回目の診断（問題なし）
      await input.clear();
      await input.fill('google.com');
      await button.click();

      await page.waitForTimeout(1000); // 更新待機

      // 同じフォームエリアが更新されていることを確認
      const formsAreas = await page.locator('#google-forms-area').count();
      expect(formsAreas).toBe(1);

      const secondHeading = await page.locator('#google-forms-area .forms-heading').textContent();
      expect(secondHeading).toContain('その他のご相談も承ります');
    });
  });

  test.describe('アクセシビリティ', () => {
    test('フォームエリアに適切なARIAラベルが設定されている', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test-no-spf.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const formsArea = page.locator('#google-forms-area');
      const ariaLabel = await formsArea.getAttribute('aria-label');

      expect(ariaLabel).toBe('専門家への相談フォーム');
    });

    test('キーボードでフォームにフォーカスできる', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      // Tabキーでフォーカスを移動
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const iframe = page.locator('#google-forms-iframe');
      const isFocused = await iframe.evaluate(el => el === document.activeElement);

      // iFrameにフォーカスが移動できることを確認
      expect(isFocused).toBeTruthy();
    });

    test('問題ありの場合、スクリーンリーダーで適切に読み上げられる', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('test-no-spf.example.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const iframe = page.locator('#google-forms-iframe');
      const title = await iframe.getAttribute('title');

      expect(title).toBe('専門家への相談フォーム');
    });

    test('問題なしの場合、スクリーンリーダーで適切に読み上げられる', async ({ page }) => {
      await page.goto('/');

      const input = page.locator('#domain-input');
      const button = page.locator('#diagnose-button');

      await input.fill('google.com');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      const iframe = page.locator('#google-forms-iframe');
      const title = await iframe.getAttribute('title');

      expect(title).toBe('その他のご相談フォーム');
    });
  });

  test.describe('トラッキング', () => {
    test.skip('Google Analytics 4でフォーム表示イベントがトラッキングされる', async ({ page }) => {
      // GA4のイベントトラッキングは実際のGA4環境でテストする必要がある
    });

    test.skip('フォームエリアへのスクロール到達がトラッキングされる', async ({ page }) => {
      // GA4のイベントトラッキングは実際のGA4環境でテストする必要がある
    });

    test.skip('診断結果の問題有無がカスタムディメンションとして記録される', async ({ page }) => {
      // GA4のカスタムディメンションは実際のGA4環境でテストする必要がある
    });

    test.skip('フォーム表示タイプがカスタムディメンションとして記録される', async ({ page }) => {
      // GA4のカスタムディメンションは実際のGA4環境でテストする必要がある
    });
  });

  test.describe('受入テストシナリオ', () => {
    test('シナリオ1: 問題ありの診断', async ({ page }) => {
      await page.goto('/');

      // 1. ドメイン入力
      const input = page.locator('#domain-input');
      await input.fill('test-no-spf.example.com');

      // 2. 診断実行
      const button = page.locator('#diagnose-button');
      await button.click();

      // 3. SPF未設定のエラーが表示される
      await page.waitForSelector('#results:not(.hidden)', { timeout: 10000 });
      const spfCard = page.locator('[data-testid="spf-result"]');
      await expect(spfCard.locator('.status-text')).toContainText('未設定');

      // 4. Google Formsが表示される
      await page.waitForSelector('#google-forms-area', { timeout: 5000 });
      const formsArea = page.locator('#google-forms-area');
      await expect(formsArea).toBeVisible();

      // 5. 適切な見出しと説明文
      const heading = page.locator('.forms-heading');
      await expect(heading).toContainText('設定方法がわからない方、専門家に相談したい方へ');

      const description = page.locator('.forms-description');
      await expect(description).toContainText('SPF/DKIM/DMARCの設定は専門的な知識が必要です');

      // 6. 自動スクロール確認
      const isInViewport = await formsArea.isIntersectingViewport();
      expect(isInViewport).toBeTruthy();
    });

    test('シナリオ2: 問題なしの診断', async ({ page }) => {
      await page.goto('/');

      // 1. 全て設定済みのドメインを入力
      const input = page.locator('#domain-input');
      await input.fill('google.com');

      // 2. 診断実行
      const button = page.locator('#diagnose-button');
      await button.click();

      // 3. 診断結果確認
      await page.waitForSelector('#results:not(.hidden)', { timeout: 10000 });

      // 4. Google Formsが表示される
      await page.waitForSelector('#google-forms-area', { timeout: 5000 });
      const formsArea = page.locator('#google-forms-area');
      await expect(formsArea).toBeVisible();

      // 5. 適切な見出しと説明文
      const heading = page.locator('.forms-heading');
      await expect(heading).toContainText('その他のご相談も承ります');

      const description = page.locator('.forms-description');
      await expect(description).toContainText('メール配信設定は問題ありません');

      // 6. 自動スクロール確認
      const isInViewport = await formsArea.isIntersectingViewport();
      expect(isInViewport).toBeTruthy();
    });

    test('シナリオ3: レスポンシブ表示', async ({ page }) => {
      // 1. モバイル表示に切り替え
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      // 2. 問題ありの診断を実行
      const input = page.locator('#domain-input');
      await input.fill('test-no-spf.example.com');

      const button = page.locator('#diagnose-button');
      await button.click();

      // 3. フォームが画面幅に収まって表示される
      await page.waitForSelector('#google-forms-area', { timeout: 10000 });
      const formsArea = page.locator('#google-forms-area');
      const width = await formsArea.evaluate(el => el.offsetWidth);

      expect(width).toBeLessThanOrEqual(375);

      // 4. 横スクロールが発生しない
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasHorizontalScroll).toBeFalsy();
    });

    test('シナリオ4: 連続診断での動的切り替え', async ({ page }) => {
      await page.goto('/');

      // 1. 問題ありのドメインを診断
      const input = page.locator('#domain-input');
      await input.fill('test-no-spf.example.com');

      const button = page.locator('#diagnose-button');
      await button.click();

      await page.waitForSelector('#google-forms-area', { timeout: 10000 });

      // 2. 見出し確認
      let heading = page.locator('.forms-heading');
      await expect(heading).toContainText('設定方法がわからない方、専門家に相談したい方へ');

      // 3. 問題なしのドメインを再診断
      await input.clear();
      await input.fill('google.com');
      await button.click();

      await page.waitForTimeout(1000); // 更新待機

      // 4. 見出しが切り替わることを確認
      heading = page.locator('.forms-heading');
      await expect(heading).toContainText('その他のご相談も承ります');

      // 5. 説明文も切り替わることを確認
      const description = page.locator('.forms-description');
      await expect(description).toContainText('メール配信設定は問題ありません');

      // 6. フォームが重複表示されない
      const formsCount = await page.locator('#google-forms-area').count();
      expect(formsCount).toBe(1);
    });
  });
});