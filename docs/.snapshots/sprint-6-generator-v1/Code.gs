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
    .addItem('▶ 選択行をチェック', 'runCheckSelected')
    .addItem('▶ 全営業リストをチェック', 'runCheckAll')
    .addSeparator()
    .addItem('結果の見方', 'showHelpDialog')
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
        '前回タイムアウトで中断された行が ' + resume.length + ' 件あります。\n続きから処理しますか？\n\n[はい] 中断した行から再開\n[いいえ] RESUME_ROWS をクリアして全件処理',
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
      SpreadsheetApp.getActiveSpreadsheet().toast('D 列に値の入った処理対象行がありません', 'メール認証チェック', 5);
      return;
    }
    BulkRunner_runForRows(rows, '全営業リスト');
  } catch (e) {
    Logger.log('runCheckAll エラー: ' + e.message + '\n' + e.stack);
    SpreadsheetApp.getActiveSpreadsheet().toast('エラー: ' + e.message, 'メール認証チェック', 10);
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
        '対象シート上で行を選択してから実行してください',
        'メール認証チェック',
        5
      );
      return;
    }
    BulkRunner_runForRows(rows, '選択行');
  } catch (e) {
    Logger.log('runCheckSelected エラー: ' + e.message + '\n' + e.stack);
    SpreadsheetApp.getActiveSpreadsheet().toast('エラー: ' + e.message, 'メール認証チェック', 10);
  }
}

/**
 * 結果の見方ダイアログ
 */
function showHelpDialog() {
  var html = '<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; padding: 16px;">'
    + '<h2 style="margin-top:0;">結果の見方</h2>'
    + '<h3>BG 列（総合判定）</h3>'
    + '<ul>'
    + '<li><b>✅ OK 3/3</b> — SPF / DKIM / DMARC すべて設定済み</li>'
    + '<li><b>⚠️ 警告 2/3</b> — 1〜2 件未設定、または注意事項あり</li>'
    + '<li><b>❌ NG 0/3</b> — すべて未設定</li>'
    + '<li><b>🔁 再実行 / &lt;理由&gt;</b> — 一時的なエラー。少し待って再実行を推奨</li>'
    + '</ul>'
    + '<h3>BH / BI / BJ 列（個別判定）</h3>'
    + '<ul>'
    + '<li><b>✅ OK | &lt;レコード&gt;</b> — 正しく設定済み</li>'
    + '<li><b>⚠️ 警告 | &lt;レコード&gt;</b> — 設定はあるが推奨設定でない</li>'
    + '<li><b>❌ NG | (レコード未検出)</b> — 設定が見つからない</li>'
    + '</ul>'
    + '<h3>再実行の代表的な原因</h3>'
    + '<ul>'
    + '<li><b>ドメイン未登録</b> — そのドメインは現在 DNS に存在しません</li>'
    + '<li><b>ドメイン形式不正</b> — 入力値からドメインを抽出できませんでした</li>'
    + '<li><b>DNSタイムアウト / DNS応答なし</b> — 一時的な通信エラー</li>'
    + '<li><b>レート制限</b> — Google Public DNS のレート制限。少し待って再実行</li>'
    + '</ul>'
    + '</div>';
  var output = HtmlService.createHtmlOutput(html).setWidth(560).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(output, '結果の見方');
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
        '履歴シートは未作成です。BK 列（実行日時）でフィルタしてご利用ください。',
        'メール認証チェック',
        10
      );
    }
  } catch (e) {
    Logger.log('openLogSheet エラー: ' + e.message);
    SpreadsheetApp.getActiveSpreadsheet().toast('エラー: ' + e.message, 'メール認証チェック', 10);
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
