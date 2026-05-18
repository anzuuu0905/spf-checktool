/**
 * Config.gs
 *
 * 定数と Script Properties 読み出しを一元管理する。
 * ハードコード値はここに集約し、ロジック側からは Config_ 経由で取得する。
 */

/** 対象スプレッドシート ID（NG 基準: 変更禁止） */
var CONFIG_SHEET_ID = '1-NbppSJfIXbUWnYUWvYa72W1Yx_kVnffBtXhZ-EpbAM';

/** 対象シートのデフォルト gid（Script Properties.SHEET_GID で上書き可能） */
var CONFIG_DEFAULT_SHEET_GID = 1728384105;

/** Google Public DNS API ベース URL */
var CONFIG_DNS_API_BASE = 'https://dns.google/resolve';

/** 結果書き込み列インデックス（1-origin） */
var CONFIG_COL_D = 4;    // D 列: 発火条件チェック
var CONFIG_COL_AC = 29;  // AC 列: ドメイン入力
var CONFIG_COL_BG = 59;  // BG 列: 総合判定
var CONFIG_COL_BH = 60;  // BH 列: SPF
var CONFIG_COL_BI = 61;  // BI 列: DKIM
var CONFIG_COL_BJ = 62;  // BJ 列: DMARC
var CONFIG_COL_BK = 63;  // BK 列: 実行日時

/** 結果書き込み列数（BG=59 から BK=63 で 5 列） */
var CONFIG_RESULT_COL_START = 59;
var CONFIG_RESULT_COL_COUNT = 5;

/**
 * DKIM プリスキャン用セレクター（7件）
 * スプリント契約で定義された 7 セレクター。
 */
var CONFIG_DKIM_SELECTORS_PRESCAN = [
  'default',
  'google',
  'selector1',
  'selector2',
  'k1',
  's1',
  'mail'
];

/**
 * DKIM フォールバック用セレクター（21件）
 * プリスキャンとの和集合で計 28 セレクター（スプリント契約準拠）。
 *
 * 元コード src/parsers/dkim-parser.js の checkCommonSelectors の代表的なセレクターから、
 * プリスキャン 7 を引き、運用上重要度の低い重複セレクター（mte2 / protonmail3 / zendesk2）を除外して 21 に整える。
 *
 * 1段階目で全滅した時のみ実行されるため、コスト最適化のためトリミング済み。
 */
var CONFIG_DKIM_SELECTORS_FALLBACK = [
  // Google Workspace（年月ベース）
  '20230601', '20210112', '20161025',
  // SendGrid / Twilio
  's2',
  // Mailchimp / Mandrill
  'k2', 'k3', 'mte1',
  // Yahoo / 汎用（鍵長ベース）
  's1024', 's2048',
  // HubSpot
  'hs1', 'hs2',
  // Brevo / Postfix
  'mail2',
  // Zoho
  'zmail',
  // Fastmail
  'fm1', 'fm2', 'fm3',
  // ProtonMail
  'protonmail', 'protonmail2',
  // Zendesk
  'zendesk1',
  // Klaviyo
  'kl',
  // 汎用
  'dkim'
];

/** チャンクサイズ上限（NG 基準: 100 件超は不可） */
var CONFIG_FETCH_CHUNK_SIZE = 100;

/** 1チャンク処理後の待機（ms）。レート制限緩和のための余裕。 */
var CONFIG_CHUNK_SLEEP_MS = 500;

/** 6 分タイムアウト直前の安全余裕（秒）。残時間がこれ未満になったら中断。 */
var CONFIG_TIME_BUFFER_SEC = 30;

/** 最大実行秒数（既定 360 秒 = 6 分。デバッグ用に Script Properties.MAX_EXECUTION_SECONDS で短縮可能） */
var CONFIG_MAX_EXECUTION_SEC_DEFAULT = 360;

/** 指数バックオフ最大リトライ回数（429 / 一時的エラー） */
var CONFIG_MAX_RETRIES = 3;

/** 指数バックオフの初期待機（ms） */
var CONFIG_BACKOFF_INITIAL_MS = 500;

/**
 * Script Properties から値を取得（未設定時はデフォルト値を返す）
 * @param {string} key
 * @param {string} defaultValue
 * @returns {string}
 */
function Config_getProp(key, defaultValue) {
  var props = PropertiesService.getScriptProperties();
  var v = props.getProperty(key);
  if (v === null || v === undefined || v === '') {
    return defaultValue;
  }
  return v;
}

/** DRY_RUN フラグ（true / false） */
function Config_isDryRun() {
  return Config_getProp('DRY_RUN', 'false') === 'true';
}

/** 対象シート gid */
function Config_getSheetGid() {
  var s = Config_getProp('SHEET_GID', String(CONFIG_DEFAULT_SHEET_GID));
  var n = parseInt(s, 10);
  if (isNaN(n)) {
    return CONFIG_DEFAULT_SHEET_GID;
  }
  return n;
}

/** START_ROW（既定 2 = ヘッダ除外の先頭行） */
function Config_getStartRow() {
  var s = Config_getProp('START_ROW', '2');
  var n = parseInt(s, 10);
  if (isNaN(n) || n < 2) {
    return 2;
  }
  return n;
}

/** END_ROW（未指定なら null = 末尾まで） */
function Config_getEndRow() {
  var s = Config_getProp('END_ROW', '');
  if (s === '') {
    return null;
  }
  var n = parseInt(s, 10);
  if (isNaN(n) || n < 2) {
    return null;
  }
  return n;
}

/** 最大実行秒数 */
function Config_getMaxExecutionSec() {
  var s = Config_getProp('MAX_EXECUTION_SECONDS', String(CONFIG_MAX_EXECUTION_SEC_DEFAULT));
  var n = parseInt(s, 10);
  if (isNaN(n) || n < 10) {
    return CONFIG_MAX_EXECUTION_SEC_DEFAULT;
  }
  return n;
}

/** RESUME_ROWS（JSON 文字列）を取得 → 配列に戻す */
function Config_getResumeRows() {
  var s = Config_getProp('RESUME_ROWS', '');
  if (!s) return null;
  try {
    var arr = JSON.parse(s);
    if (Array.isArray(arr) && arr.length > 0) {
      return arr;
    }
    return null;
  } catch (e) {
    Logger.log('RESUME_ROWS の JSON パース失敗: ' + e.message);
    return null;
  }
}

/** RESUME_ROWS をセット（数値配列を JSON 化） */
function Config_setResumeRows(rows) {
  PropertiesService.getScriptProperties()
    .setProperty('RESUME_ROWS', JSON.stringify(rows));
}

/** RESUME_ROWS をクリア */
function Config_clearResumeRows() {
  PropertiesService.getScriptProperties().deleteProperty('RESUME_ROWS');
}

/**
 * プリスキャン + フォールバック を合わせた完全な 28 セレクター辞書を返す。
 * デバッグ用 / 検証用。
 */
function Config_getAllDkimSelectors() {
  var all = CONFIG_DKIM_SELECTORS_PRESCAN.concat(CONFIG_DKIM_SELECTORS_FALLBACK);
  // 重複排除
  var seen = {};
  var result = [];
  for (var i = 0; i < all.length; i++) {
    if (!seen[all[i]]) {
      seen[all[i]] = true;
      result.push(all[i]);
    }
  }
  return result;
}
