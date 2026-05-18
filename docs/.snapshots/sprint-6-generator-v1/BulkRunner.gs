/**
 * BulkRunner.gs
 *
 * 全行・選択行のループ制御、チャンク I/O、進捗 toast、タイムアウト復帰の中核。
 *
 * 主要関数:
 *   - BulkRunner_runForRows(rows): 行番号配列を受け取り処理する（全行 / 選択行 / RESUME 共通）
 *   - BulkRunner_processOneRow(domain): 1 ドメイン → 結果文字列（純粋関数、テスト容易）
 *   - BulkRunner_formatRecord_(record): 文字列が長すぎる場合の切り詰め
 */

/**
 * メインエントリ: 行番号配列を受け取って一括処理する。
 *
 * @param {Array<number>} rows
 * @param {string} contextLabel - toast 用ラベル（"全営業リスト" / "選択行" / "再開" など）
 */
function BulkRunner_runForRows(rows, contextLabel) {
  if (!rows || rows.length === 0) {
    SpreadsheetApp.getActiveSpreadsheet().toast('処理対象がありません', 'メール認証チェック', 5);
    return;
  }

  var startTime = new Date().getTime();
  var maxExecutionSec = Config_getMaxExecutionSec();
  var timeBufferSec = CONFIG_TIME_BUFFER_SEC;
  var dryRun = Config_isDryRun();

  var range = SheetIO_getProcessingRange();
  var sheet = range.sheet;

  // 対象行を valid な範囲に絞る
  var validRows = [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i] >= 2) {
      validRows.push(rows[i]);
    }
  }
  if (validRows.length === 0) {
    SpreadsheetApp.getActiveSpreadsheet().toast('処理対象がありません', 'メール認証チェック', 5);
    return;
  }

  // 行を昇順ソート
  validRows.sort(function (a, b) { return a - b; });

  // 開始 toast
  SpreadsheetApp.getActiveSpreadsheet().toast(
    contextLabel + ' チェック開始: ' + validRows.length + ' 件' + (dryRun ? '（DRY_RUN）' : ''),
    'メール認証チェック',
    5
  );

  // D 列 / AC 列の値をまとめて読み出すために最小・最大行で範囲取得
  var minRow = validRows[0];
  var maxRow = validRows[validRows.length - 1];
  var dAcAll = SheetIO_readDAndAC(sheet, minRow, maxRow);
  var dAcMap = {};
  for (var d = 0; d < dAcAll.length; d++) {
    dAcMap[dAcAll[d].row] = dAcAll[d];
  }

  // チャンク単位で処理（チャンクサイズはローカル制御。fetchAll の内部チャンクとは独立。）
  // ここでは「進捗 toast 表示と⏳書き込みを適切な粒度で行う」ためのバッチサイズ。
  var BATCH_SIZE = 5; // 1 バッチ = 5 行ごとに setValues / 進捗書き込み
  var stats = { ok: 0, warn: 0, ng: 0, retry: 0, skipped: 0 };

  var unprocessedRows = validRows.slice(); // 後で RESUME に保存する用

  for (var b = 0; b < validRows.length; b += BATCH_SIZE) {
    var batch = validRows.slice(b, b + BATCH_SIZE);

    // タイムアウトチェック
    var elapsedSec = (new Date().getTime() - startTime) / 1000;
    if (elapsedSec + timeBufferSec >= maxExecutionSec) {
      Logger.log('タイムアウト直前のため中断: 残り行数=' + unprocessedRows.length);
      Config_setResumeRows(unprocessedRows);
      SpreadsheetApp.getActiveSpreadsheet().toast(
        '時間切れで中断しました。再実行で続きから処理されます。残: ' + unprocessedRows.length + '件',
        'メール認証チェック',
        15
      );
      return;
    }

    // ⏳ 確認中を書き込み（DRY_RUN 時はスキップ）
    var inProgressRows = [];
    for (var ip = 0; ip < batch.length; ip++) {
      var info = dAcMap[batch[ip]];
      // AC 列が空の場合は ⏳ も書かない（スキップ対象）
      if (info && info.acValue !== null && info.acValue !== undefined && String(info.acValue).trim() !== '') {
        inProgressRows.push(batch[ip]);
      }
    }
    SheetIO_markInProgress(sheet, inProgressRows);

    // バッチ内の各行を処理
    var results = [];
    for (var r = 0; r < batch.length; r++) {
      var row = batch[r];
      var info2 = dAcMap[row];
      var dVal = info2 ? info2.dValue : null;
      var acVal = info2 ? info2.acValue : null;

      // D 列が空ならスキップ
      if (dVal === null || dVal === undefined || String(dVal).trim() === '') {
        stats.skipped++;
        Logger.log('行 ' + row + ': D 列空のためスキップ');
        continue;
      }

      // AC 列が空ならスキップ（書き込みなし）
      if (acVal === null || acVal === undefined || String(acVal).trim() === '') {
        stats.skipped++;
        Logger.log('行 ' + row + ': AC 列空のためスキップ');
        continue;
      }

      var rowResult = BulkRunner_processOneRow(String(acVal));
      // 統計
      if (rowResult.bgStatus === 'ok') stats.ok++;
      else if (rowResult.bgStatus === 'warn') stats.warn++;
      else if (rowResult.bgStatus === 'ng') stats.ng++;
      else if (rowResult.bgStatus === 'retry') stats.retry++;

      results.push({
        row: row,
        bg: rowResult.bg,
        bh: rowResult.bh,
        bi: rowResult.bi,
        bj: rowResult.bj,
        bk: rowResult.bk
      });

      if (dryRun) {
        Logger.log('[DRY_RUN] 行 ' + row + ' / domain=' + acVal + ' → ' + JSON.stringify(rowResult));
      }
    }

    // 結果書き込み
    SheetIO_writeResults(sheet, results);

    // 処理済み行を unprocessedRows から除外
    var stillUnprocessed = [];
    var batchSet = {};
    for (var bx = 0; bx < batch.length; bx++) batchSet[batch[bx]] = true;
    for (var u = 0; u < unprocessedRows.length; u++) {
      if (!batchSet[unprocessedRows[u]]) {
        stillUnprocessed.push(unprocessedRows[u]);
      }
    }
    unprocessedRows = stillUnprocessed;
  }

  // 全件完了 → RESUME_ROWS をクリア
  Config_clearResumeRows();

  // 完了 toast
  var msg = '完了：✅ ' + stats.ok + ' / ⚠️ ' + stats.warn + ' / ❌ ' + stats.ng + ' / 🔁 ' + stats.retry;
  if (stats.skipped > 0) {
    msg += ' / スキップ ' + stats.skipped;
  }
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'メール認証チェック', 10);
  Logger.log('処理完了: ' + msg);
}

/**
 * 1 ドメイン分の処理 → BG〜BK 5 列の文字列を生成。
 * 純粋関数として実装。DNS クエリは内部で実行する。
 *
 * @param {string} rawDomain - AC 列の値（正規化前）
 * @returns {{bg:string, bh:string, bi:string, bj:string, bk:string, bgStatus:string}}
 */
function BulkRunner_processOneRow(rawDomain) {
  var now = BulkRunner_formatTimestamp_(new Date());
  var blankResult = { bg: '', bh: '', bi: '', bj: '', bk: now, bgStatus: 'retry' };

  // 正規化
  var domain;
  try {
    domain = DomainNormalizer_normalize(rawDomain);
  } catch (e) {
    return {
      bg: '🔁 再実行 / ドメイン形式不正',
      bh: '',
      bi: '',
      bj: '',
      bk: now,
      bgStatus: 'retry'
    };
  }

  // SPF + DMARC 並列クエリ（3 リクエスト = 1 fetchAll）
  var spfDmarc;
  try {
    spfDmarc = DnsResolver_getSPFAndDMARC(domain);
  } catch (e) {
    return {
      bg: '🔁 再実行 / ' + BulkRunner_truncateError_(e.message),
      bh: '',
      bi: '',
      bj: '',
      bk: now,
      bgStatus: 'retry'
    };
  }

  // NXDOMAIN（ドメイン未登録）
  if (spfDmarc.spfError === 'NXDOMAIN' || !spfDmarc.mainExists) {
    return {
      bg: '🔁 再実行 / ドメイン未登録',
      bh: '',
      bi: '',
      bj: '',
      bk: now,
      bgStatus: 'retry'
    };
  }

  // TIMEOUT / NETWORK_ERROR / RATE_LIMIT 系
  if (spfDmarc.spfError === 'TIMEOUT' || spfDmarc.dmarcError === 'TIMEOUT') {
    return {
      bg: '🔁 再実行 / DNSタイムアウト',
      bh: '',
      bi: '',
      bj: '',
      bk: now,
      bgStatus: 'retry'
    };
  }
  if (spfDmarc.spfError === 'RATE_LIMIT' || spfDmarc.dmarcError === 'RATE_LIMIT') {
    return {
      bg: '🔁 再実行 / レート制限',
      bh: '',
      bi: '',
      bj: '',
      bk: now,
      bgStatus: 'retry'
    };
  }
  if (spfDmarc.spfError === 'NETWORK_ERROR' || spfDmarc.dmarcError === 'NETWORK_ERROR') {
    return {
      bg: '🔁 再実行 / DNS応答なし',
      bh: '',
      bi: '',
      bj: '',
      bk: now,
      bgStatus: 'retry'
    };
  }

  // DKIM クエリ（プリスキャン → フォールバック の 2 段階）
  var dkim;
  try {
    dkim = DnsResolver_getDKIM2Stage(domain);
  } catch (e) {
    return {
      bg: '🔁 再実行 / ' + BulkRunner_truncateError_(e.message),
      bh: '',
      bi: '',
      bj: '',
      bk: now,
      bgStatus: 'retry'
    };
  }

  // 診断
  var spfDiag = SpfDiagnosis_diagnoseSPF(spfDmarc.spf);
  var dkimDiag = DkimDiagnosis_diagnoseDKIMMultiple(dkim.found);
  var dmarcDiag = DmarcDiagnosis_diagnoseDMARC(spfDmarc.dmarc);

  // BH / BI / BJ 各列文字列を生成
  var bh = BulkRunner_formatColumn_(spfDiag, spfDmarc.spf, 'SPF');
  var bi = BulkRunner_formatDkimColumn_(dkimDiag, dkim.found);
  var bj = BulkRunner_formatColumn_(dmarcDiag, spfDmarc.dmarc, 'DMARC');

  // BG 列: 総合判定（OK 数 / 3）
  var okCount = 0;
  if (spfDiag.status === 'configured') okCount++;
  if (dkimDiag.status === 'configured') okCount++;
  if (dmarcDiag.status === 'configured') okCount++;

  var bg;
  var bgStatus;
  if (okCount === 3) {
    // 全て configured
    // ただし warning が含まれていたら ⚠️ 警告 3/3 とする
    var anyWarn = (spfDiag.level === 'warning') || (dkimDiag.level === 'warning') || (dmarcDiag.level === 'warning' || dmarcDiag.level === 'info');
    if (anyWarn) {
      bg = '⚠️ 警告 ' + okCount + '/3';
      bgStatus = 'warn';
    } else {
      bg = '✅ OK ' + okCount + '/3';
      bgStatus = 'ok';
    }
  } else if (okCount === 0) {
    bg = '❌ NG ' + okCount + '/3';
    bgStatus = 'ng';
  } else {
    bg = '⚠️ 警告 ' + okCount + '/3';
    bgStatus = 'warn';
  }

  return {
    bg: bg,
    bh: bh,
    bi: bi,
    bj: bj,
    bk: now,
    bgStatus: bgStatus
  };
}

/**
 * SPF / DMARC 列文字列生成
 * @private
 */
function BulkRunner_formatColumn_(diagnosis, record, label) {
  if (diagnosis.status === 'configured') {
    var prefix = (diagnosis.level === 'success') ? '✅ OK' : '⚠️ 警告';
    return prefix + ' | ' + BulkRunner_truncateRecord_(record);
  }
  if (diagnosis.status === 'not_configured') {
    return '❌ NG | (レコード未検出)';
  }
  return '❌ NG | エラー';
}

/**
 * DKIM 列文字列生成
 * @private
 */
function BulkRunner_formatDkimColumn_(diagnosis, foundList) {
  if (diagnosis.status === 'configured') {
    var prefix = (diagnosis.level === 'success') ? '✅ OK' : '⚠️ 警告';
    var selectorList = [];
    for (var i = 0; i < foundList.length; i++) {
      selectorList.push(foundList[i].selector);
    }
    var selectorStr = selectorList.length > 0 ? ' [' + selectorList.join(', ') + ']' : '';
    // レコード本体は最初の 1 件だけ表示（長くなりすぎないように）
    var record = foundList.length > 0 ? foundList[0].record : '';
    return prefix + selectorStr + ' | ' + BulkRunner_truncateRecord_(record);
  }
  return '❌ NG | (レコード未検出)';
}

/**
 * レコード文字列を 200 文字以内に切り詰める（セルあふれ防止）
 * @private
 */
function BulkRunner_truncateRecord_(record) {
  if (!record) return '(レコード未検出)';
  var s = String(record);
  if (s.length > 200) {
    return s.substring(0, 197) + '...';
  }
  return s;
}

/**
 * エラーメッセージを 50 文字以内に切り詰める
 * @private
 */
function BulkRunner_truncateError_(msg) {
  if (!msg) return '不明なエラー';
  var s = String(msg);
  if (s.length > 50) return s.substring(0, 47) + '...';
  return s;
}

/**
 * 日時を 'YYYY-MM-DD HH:mm' 形式にフォーマット（Asia/Tokyo）
 * @private
 */
function BulkRunner_formatTimestamp_(date) {
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
}

/**
 * 全営業リストモード: D 列に値が入った全行を集める
 * @returns {Array<number>}
 */
function BulkRunner_collectAllTargetRows() {
  var range = SheetIO_getProcessingRange();
  if (range.endRow < range.startRow) return [];
  var sheet = range.sheet;

  var data = SheetIO_readDAndAC(sheet, range.startRow, range.endRow);
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    var dv = data[i].dValue;
    if (dv !== null && dv !== undefined && String(dv).trim() !== '') {
      rows.push(data[i].row);
    }
  }
  return rows;
}

/**
 * 選択行モード: getActiveRange() の範囲から行番号配列を生成
 * @returns {Array<number>}
 */
function BulkRunner_collectSelectedRows() {
  var ss = SheetIO_openSpreadsheet();
  var sheet = SheetIO_getTargetSheet(ss);
  var active = SpreadsheetApp.getActiveSheet();

  // 操作中のシートが対象シートと一致しなければ空
  if (!active || active.getSheetId() !== sheet.getSheetId()) {
    return [];
  }

  var ranges = active.getActiveRangeList();
  var rowSet = {};
  if (ranges) {
    var rs = ranges.getRanges();
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      var start = r.getRow();
      var num = r.getNumRows();
      for (var j = 0; j < num; j++) {
        var rr = start + j;
        if (rr >= 2) {
          rowSet[rr] = true;
        }
      }
    }
  } else {
    var single = active.getActiveRange();
    if (single) {
      var s2 = single.getRow();
      var n2 = single.getNumRows();
      for (var k = 0; k < n2; k++) {
        var rr2 = s2 + k;
        if (rr2 >= 2) rowSet[rr2] = true;
      }
    }
  }

  var rows = [];
  for (var key in rowSet) {
    if (rowSet.hasOwnProperty(key)) {
      rows.push(parseInt(key, 10));
    }
  }
  return rows;
}
