/**
 * Code.gs
 *
 * GAS エントリポイント。
 *   - onOpen: カスタムメニュー登録
 *   - runCheckAll / runCheckSelected / runResumeFromState: メニューハンドラ
 *   - showHelpDialog / openLogSheet: 補助メニュー
 *   - testDryRun: GAS エディタから直接実行する単体テスト関数
 */

/**
 * スプレッドシートを開いた時に発火する。
 * カスタムメニュー「メール認証チェック」を登録。
 *
 * @param {GoogleAppsScript.Events.SheetsOnOpen} e
 */
function onOpen(e) {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('メール認証チェック')
    .addItem('▶ 選択した行だけチェック', 'runCheckSelected')
    .addItem('▶ 全営業リストをまとめてチェック', 'runCheckAll')
    .addSeparator()
    .addItem('結果の見方 / 使い方', 'showHelpDialog')
    .addItem('履歴シートを開く', 'openLogSheet')
    .addToUi();
}

/**
 * 全営業リストをチェック
 */
function runCheckAll() {
  try {
    // RESUME_ROWS があれば優先
    var resume = Config_getResumeRows();
    if (resume && resume.length > 0) {
      var ui = SpreadsheetApp.getUi();
      var resp = ui.alert(
        'メール認証チェック',
        '前回、時間切れで中断された行が ' + resume.length + ' 件あります。\n続きから処理しますか？\n\n[はい] 中断した行から再開する\n[いいえ] 再開情報をリセットして、全件をやり直す',
        ui.ButtonSet.YES_NO
      );
      if (resp === ui.Button.YES) {
        BulkRunner_runForRows(resume, '再開');
        return;
      } else {
        Config_clearResumeRows();
      }
    }

    var rows = BulkRunner_collectAllTargetRows();
    if (rows.length === 0) {
      SpreadsheetApp.getActiveSpreadsheet().toast('チェック対象がありません（D 列が空です）', 'メール認証チェック', 5);
      return;
    }
    BulkRunner_runForRows(rows, '全営業リスト');
  } catch (e) {
    Logger.log('runCheckAll エラー: ' + e.message + '\n' + e.stack);
    SpreadsheetApp.getActiveSpreadsheet().toast('処理中にエラーが発生しました：' + e.message, 'メール認証チェック', 10);
  }
}

/**
 * 選択行をチェック
 */
function runCheckSelected() {
  try {
    var rows = BulkRunner_collectSelectedRows();
    if (rows.length === 0) {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        'チェックしたい行を選択してから、もう一度メニューを実行してください',
        'メール認証チェック',
        5
      );
      return;
    }
    BulkRunner_runForRows(rows, '選択行');
  } catch (e) {
    Logger.log('runCheckSelected エラー: ' + e.message + '\n' + e.stack);
    SpreadsheetApp.getActiveSpreadsheet().toast('処理中にエラーが発生しました：' + e.message, 'メール認証チェック', 10);
  }
}

/**
 * 結果の見方ダイアログ
 */
function showHelpDialog() {
  var html = '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; line-height: 1.65; padding: 20px 24px; color: #1f2937;">'
    // タイトル
    + '<h2 style="margin: 0 0 4px 0; font-size: 20px; color: #111827;">結果の見方 / 使い方</h2>'
    + '<p style="margin: 0 0 20px 0; color: #6b7280; font-size: 13px;">メール認証チェック（SPF / DKIM / DMARC）の判定結果を、シート上で読み解くためのガイドです。</p>'

    // ステップ
    + '<div style="background: #f3f4f6; border-left: 4px solid #2563eb; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">'
    + '<div style="font-weight: 600; margin-bottom: 6px; color: #111827;">使い方（3 ステップ）</div>'
    + '<ol style="margin: 0; padding-left: 20px;">'
    + '<li>チェックしたい行を選ぶ（または全営業リスト）</li>'
    + '<li>メニュー「メール認証チェック」から実行</li>'
    + '<li>BG 列の総合判定で「✅ / ⚠️ / ❌ / 🔁」を確認</li>'
    + '</ol>'
    + '</div>'

    // BG 列
    + '<h3 style="margin: 16px 0 8px 0; font-size: 15px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">BG 列：総合判定（このドメインの状態を一目で）</h3>'
    + '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">'
    + '<tr><td style="padding: 6px 8px; white-space: nowrap; vertical-align: top;"><b>✅ OK 3/3</b></td><td style="padding: 6px 8px;">SPF / DKIM / DMARC が 3 つともきちんと設定されている（理想形）</td></tr>'
    + '<tr style="background: #fafafa;"><td style="padding: 6px 8px; white-space: nowrap; vertical-align: top;"><b>⚠️ 警告 2/3</b></td><td style="padding: 6px 8px;">3 つのうち「2 つ OK」。残り 1 つが未設定、または推奨外の設定</td></tr>'
    + '<tr><td style="padding: 6px 8px; white-space: nowrap; vertical-align: top;"><b>⚠️ 警告 3/3</b></td><td style="padding: 6px 8px;">3 つとも設定はあるが、推奨外の項目を含む（DMARC が p=none など）</td></tr>'
    + '<tr style="background: #fafafa;"><td style="padding: 6px 8px; white-space: nowrap; vertical-align: top;"><b>❌ NG 0/3</b></td><td style="padding: 6px 8px;">3 つともまったく設定されていない（迷惑メール扱いされやすい）</td></tr>'
    + '<tr><td style="padding: 6px 8px; white-space: nowrap; vertical-align: top;"><b>🔁 再実行 / 理由</b></td><td style="padding: 6px 8px;">通信エラー・一時的な障害などで判定できなかった。後でもう一度実行</td></tr>'
    + '</table>'
    + '<p style="margin: 6px 0 0 0; font-size: 12px; color: #6b7280;">※ 「2/3」は「3 つのうち 2 つが OK」という意味です。</p>'

    // BH/BI/BJ 列
    + '<h3 style="margin: 20px 0 8px 0; font-size: 15px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">BH / BI / BJ 列：個別判定（SPF・DKIM・DMARC それぞれの中身）</h3>'
    + '<ul style="margin: 0; padding-left: 20px; font-size: 13px;">'
    + '<li><b>BH 列</b> = SPF の判定とレコード本文</li>'
    + '<li><b>BI 列</b> = DKIM の判定とレコード本文（[セレクタ名] 付き）</li>'
    + '<li><b>BJ 列</b> = DMARC の判定とレコード本文</li>'
    + '</ul>'
    + '<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">'
    + '<tr><td style="padding: 6px 8px; white-space: nowrap; vertical-align: top;"><b>✅ OK | …</b></td><td style="padding: 6px 8px;">正しく設定されている。「|」の右側が実際のレコード内容</td></tr>'
    + '<tr style="background: #fafafa;"><td style="padding: 6px 8px; white-space: nowrap; vertical-align: top;"><b>⚠️ 警告 | …</b></td><td style="padding: 6px 8px;">設定はあるが、推奨設定ではない（弱い設定など）</td></tr>'
    + '<tr><td style="padding: 6px 8px; white-space: nowrap; vertical-align: top;"><b>❌ NG | (レコード未検出)</b></td><td style="padding: 6px 8px;">DNS にレコードが存在しない（未設定）</td></tr>'
    + '</table>'
    + '<p style="margin: 6px 0 0 0; font-size: 12px; color: #6b7280;">※ 長いレコードはセル内で 200 文字までに省略表示しています（…）。クリックして数式バーで全文確認できます。</p>'

    // 🔁 の対処
    + '<h3 style="margin: 20px 0 8px 0; font-size: 15px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">🔁 再実行が出た時の対処</h3>'
    + '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">'
    + '<tr><td style="padding: 6px 8px; white-space: nowrap; vertical-align: top;"><b>ドメイン未登録</b></td><td style="padding: 6px 8px;">そのドメインが DNS 上に存在しない。閉鎖済みの可能性。営業対象から外す判断を</td></tr>'
    + '<tr style="background: #fafafa;"><td style="padding: 6px 8px; white-space: nowrap; vertical-align: top;"><b>ドメイン形式不正</b></td><td style="padding: 6px 8px;">入力値（AC 列）からドメインを取り出せなかった。値を見直す</td></tr>'
    + '<tr><td style="padding: 6px 8px; white-space: nowrap; vertical-align: top;"><b>DNSタイムアウト / 応答なし</b></td><td style="padding: 6px 8px;">一時的な通信エラー。数分待ってその行を再実行</td></tr>'
    + '<tr style="background: #fafafa;"><td style="padding: 6px 8px; white-space: nowrap; vertical-align: top;"><b>レート制限</b></td><td style="padding: 6px 8px;">Google DNS の制限に達した。少し時間を置いてから再実行</td></tr>'
    + '</table>'

    // 見方のコツ
    + '<h3 style="margin: 20px 0 8px 0; font-size: 15px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">シート上で活用するコツ</h3>'
    + '<ul style="margin: 0; padding-left: 20px; font-size: 13px;">'
    + '<li><b>BG 列でフィルタ</b>すると、状態別（OK / 警告 / NG / 再実行）に営業先を絞り込めます</li>'
    + '<li><b>BK 列（実行日時）でソート</b>すると、最近チェックした行と未チェックの行を見分けられます</li>'
    + '<li>「🔁 再実行」だけを残してフィルタ → メニューから「選択した行だけチェック」で効率的に再診断できます</li>'
    + '<li>長時間実行で時間切れになっても、再実行すれば自動で続きから処理されます</li>'
    + '</ul>'

    + '</div>';
  var output = HtmlService.createHtmlOutput(html).setWidth(640).setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(output, '結果の見方 / 使い方');
}

/**
 * 履歴シートを開く（簡易実装）
 *
 * 「履歴」シートが存在すれば activate、無ければトーストで案内。
 */
function openLogSheet() {
  try {
    var ss = SheetIO_openSpreadsheet();
    var sheets = ss.getSheets();
    var logSheet = null;
    for (var i = 0; i < sheets.length; i++) {
      var name = sheets[i].getName();
      if (name === '履歴' || name === '実行履歴' || name === 'メール認証チェック履歴') {
        logSheet = sheets[i];
        break;
      }
    }
    if (logSheet) {
      logSheet.activate();
    } else {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        '履歴シートはまだ作成されていません。当面は BK 列（実行日時）でソートやフィルタを使ってご確認ください。',
        'メール認証チェック',
        10
      );
    }
  } catch (e) {
    Logger.log('openLogSheet エラー: ' + e.message);
    SpreadsheetApp.getActiveSpreadsheet().toast('処理中にエラーが発生しました：' + e.message, 'メール認証チェック', 10);
  }
}

/**
 * GAS エディタから直接実行する単体テスト関数。
 *
 * 既知の正解 10 件のドメインに対し、processOneRow を呼び出して Logger に出力する。
 * シートへの書き込みは一切発生しない。
 *
 * 使い方:
 *   1. GAS エディタで「testDryRun」を選択
 *   2. 「実行」ボタン
 *   3. 表示ログから判定結果を目視確認
 */
function testDryRun() {
  var domains = [
    'google.com',
    'gmail.com',
    'microsoft.com',
    'github.com',
    'paypal.com',
    'amazon.co.jp',
    'yahoo.co.jp',
    'apple.com',
    'cloudflare.com',
    'anthropic.com'
  ];

  Logger.log('=== testDryRun: 既知正解 10 件の判定 ===');
  for (var i = 0; i < domains.length; i++) {
    var result;
    try {
      result = BulkRunner_processOneRow(domains[i]);
    } catch (e) {
      Logger.log('[' + (i + 1) + '/10] ' + domains[i] + ' → EXCEPTION: ' + e.message);
      continue;
    }
    Logger.log('[' + (i + 1) + '/10] ' + domains[i]);
    Logger.log('   BG: ' + result.bg);
    Logger.log('   BH: ' + result.bh);
    Logger.log('   BI: ' + result.bi);
    Logger.log('   BJ: ' + result.bj);
    Logger.log('   BK: ' + result.bk);
  }
  Logger.log('=== testDryRun: 完了 ===');
}

/**
 * GAS エディタから直接実行する単体テスト関数（正規化のみ）。
 *
 * DomainNormalizer の動作確認用。
 */
function testNormalizer() {
  var inputs = [
    'carbuncle.biz',
    'CARBUNCLE.BIZ',
    '  carbuncle.biz  ',
    'https://carbuncle.biz/contact',
    'http://carbuncle.biz:8080/foo?bar=1',
    'user:pass@carbuncle.biz',
    '日本語.jp',  // IDN → xn--
    '',
    '   ',
    'invalid',
    'a.b.c.d.e',
    'foo--bar.com'
  ];
  Logger.log('=== testNormalizer ===');
  for (var i = 0; i < inputs.length; i++) {
    try {
      var out = DomainNormalizer_normalize(inputs[i]);
      Logger.log('  IN: "' + inputs[i] + '" → OUT: "' + out + '"');
    } catch (e) {
      Logger.log('  IN: "' + inputs[i] + '" → ERROR: ' + e.message);
    }
  }
}

/**
 * GAS エディタから直接実行する単体テスト関数（パース/診断のみ）。
 *
 * DNS クエリを行わず、サンプル文字列に対するパース・診断結果を Logger に出力。
 */
function testParseAndDiagnose() {
  Logger.log('=== testParseAndDiagnose ===');

  // SPF
  var spfSample = 'v=spf1 include:_spf.google.com ~all';
  var spfDiag = SpfDiagnosis_diagnoseSPF(spfSample);
  Logger.log('SPF input: ' + spfSample);
  Logger.log('  → status=' + spfDiag.status + ' level=' + spfDiag.level);

  // DKIM
  var dkimSample = 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoCS+1RaG3aF9bP5dB1Dh+0G6Ka39rO9MwTvNzNYr3yLqUjnQpVQTjOoUMnIvR0EwzS2HC7ZcRm6Jzm0bDmH';
  var dkimDiag = DkimDiagnosis_diagnoseDKIM(dkimSample, 'google');
  Logger.log('DKIM input: ' + dkimSample.substring(0, 40) + '...');
  Logger.log('  → status=' + dkimDiag.status + ' level=' + dkimDiag.level + ' keyLength=' + (dkimDiag.details ? dkimDiag.details.keyLength : null));

  // DMARC
  var dmarcSample = 'v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@example.com';
  var dmarcDiag = DmarcDiagnosis_diagnoseDMARC(dmarcSample);
  Logger.log('DMARC input: ' + dmarcSample);
  Logger.log('  → status=' + dmarcDiag.status + ' level=' + dmarcDiag.level + ' policy=' + (dmarcDiag.details ? dmarcDiag.details.policy : null));

  // 未設定パターン
  Logger.log('SPF null → ' + JSON.stringify(SpfDiagnosis_diagnoseSPF(null).status));
  Logger.log('DKIM null → ' + JSON.stringify(DkimDiagnosis_diagnoseDKIM(null, null).status));
  Logger.log('DMARC null → ' + JSON.stringify(DmarcDiagnosis_diagnoseDMARC(null).status));
}

/**
 * GAS エディタから直接実行する単体テスト関数（冪等性確認）。
 * 同じドメインを 2 回処理して bg/bh/bi/bj が一致することを確認する（bk のみ変化を許容）。
 */
function testIdempotency() {
  var domains = ['google.com', 'github.com'];
  Logger.log('=== testIdempotency ===');
  for (var i = 0; i < domains.length; i++) {
    var d = domains[i];
    var r1 = BulkRunner_processOneRow(d);
    Utilities.sleep(1500);
    var r2 = BulkRunner_processOneRow(d);
    var match = (r1.bg === r2.bg) && (r1.bh === r2.bh) && (r1.bi === r2.bi) && (r1.bj === r2.bj);
    Logger.log(d + ' → 冪等性 ' + (match ? 'OK' : 'NG'));
    if (!match) {
      Logger.log('  1st: ' + JSON.stringify(r1));
      Logger.log('  2nd: ' + JSON.stringify(r2));
    }
  }
}
