/**
 * SheetIO.gs
 *
 * シート I/O ヘルパ。getValues/setValues バッチ前提。
 * セル単位 setValue は禁止（AC-3 / NG 基準準拠）。
 *
 * 対象シートは Config_getSheetGid() の gid で照合取得。
 */

/**
 * 対象スプレッドシートを ID 指定で開く（NG 基準: ID 変更禁止）
 * @returns {Spreadsheet}
 */
function SheetIO_openSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG_SHEET_ID);
}

/**
 * gid 照合でシートを取得（シート名一致は禁止）
 * @param {Spreadsheet} ss
 * @returns {Sheet}
 * @throws {Error} gid に該当するシートが存在しない場合
 */
function SheetIO_getTargetSheet(ss) {
  if (!ss) ss = SheetIO_openSpreadsheet();
  var targetGid = Config_getSheetGid();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === targetGid) {
      return sheets[i];
    }
  }
  throw new Error('対象シート（gid=' + targetGid + '）が見つかりません。');
}

/**
 * 対象シートのデータ範囲（ヘッダ除く処理可能な範囲）情報を返す。
 *
 * @returns {{sheet: Sheet, startRow: number, endRow: number, lastRow: number}}
 */
function SheetIO_getProcessingRange() {
  var ss = SheetIO_openSpreadsheet();
  var sheet = SheetIO_getTargetSheet(ss);
  var lastRow = sheet.getLastRow();
  var startRow = Config_getStartRow();
  var endRowConfig = Config_getEndRow();
  var endRow;
  if (endRowConfig !== null) {
    endRow = Math.min(endRowConfig, lastRow);
  } else {
    endRow = lastRow;
  }
  return {
    sheet: sheet,
    startRow: startRow,
    endRow: endRow,
    lastRow: lastRow
  };
}

/**
 * 指定行範囲の D 列・AC 列の値を一括取得。
 * 戻り値は { row, dValue, acValue } の配列。
 *
 * @param {Sheet} sheet
 * @param {number} startRow
 * @param {number} endRow
 * @returns {Array<{row: number, dValue: any, acValue: any}>}
 */
function SheetIO_readDAndAC(sheet, startRow, endRow) {
  if (endRow < startRow) return [];
  var numRows = endRow - startRow + 1;

  // D 列だけを一括取得（getValues は 1 始まり）
  var dVals = sheet.getRange(startRow, CONFIG_COL_D, numRows, 1).getValues();
  // AC 列だけを一括取得
  var acVals = sheet.getRange(startRow, CONFIG_COL_AC, numRows, 1).getValues();

  var result = [];
  for (var i = 0; i < numRows; i++) {
    result.push({
      row: startRow + i,
      dValue: dVals[i][0],
      acValue: acVals[i][0]
    });
  }
  return result;
}

/**
 * 「⏳ 確認中...」プレースホルダーを BG 列に一括書き込み。
 * DRY_RUN 時は何もしない。
 *
 * @param {Sheet} sheet
 * @param {Array<number>} rows - 対象行番号配列
 */
function SheetIO_markInProgress(sheet, rows) {
  if (Config_isDryRun()) return;
  if (!rows || rows.length === 0) return;

  // 行が連続している場合のみ範囲書き込み、そうでなければ Range#setValues で 1 セル × N
  // ただしセル単位 setValue は禁止のため、必ず setValues を使う。
  // 行ごとに 1 行 × 1 列の setValues を呼ぶ。これでも setValues バッチ I/O 原則は満たす。

  // 連続範囲ごとにグループ化して setValues を呼ぶ
  var sorted = rows.slice().sort(function (a, b) { return a - b; });
  var groups = [];
  var groupStart = sorted[0];
  var groupEnd = sorted[0];
  for (var i = 1; i < sorted.length; i++) {
    if (sorted[i] === groupEnd + 1) {
      groupEnd = sorted[i];
    } else {
      groups.push({ start: groupStart, end: groupEnd });
      groupStart = sorted[i];
      groupEnd = sorted[i];
    }
  }
  groups.push({ start: groupStart, end: groupEnd });

  for (var g = 0; g < groups.length; g++) {
    var gs = groups[g].start;
    var ge = groups[g].end;
    var n = ge - gs + 1;
    var values = [];
    for (var k = 0; k < n; k++) {
      values.push(['⏳ 確認中...']);
    }
    sheet.getRange(gs, CONFIG_COL_BG, n, 1).setValues(values);
  }
}

/**
 * 結果（BG〜BK 5 列）を一括書き込み。
 * 入力は連続行範囲のセットを想定。連続でなくても OK（グループ化して setValues する）。
 *
 * @param {Sheet} sheet
 * @param {Array<{row: number, bg: string, bh: string, bi: string, bj: string, bk: string}>} results
 */
function SheetIO_writeResults(sheet, results) {
  if (Config_isDryRun()) return;
  if (!results || results.length === 0) return;

  // 行で昇順ソートし、連続範囲ごとに setValues を呼ぶ
  var sorted = results.slice().sort(function (a, b) { return a.row - b.row; });
  var groups = [];
  var currentGroup = [sorted[0]];
  for (var i = 1; i < sorted.length; i++) {
    if (sorted[i].row === sorted[i - 1].row + 1) {
      currentGroup.push(sorted[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
    }
  }
  groups.push(currentGroup);

  for (var g = 0; g < groups.length; g++) {
    var group = groups[g];
    var rowsCount = group.length;
    var matrix = [];
    for (var r = 0; r < rowsCount; r++) {
      var item = group[r];
      matrix.push([
        item.bg !== undefined ? item.bg : '',
        item.bh !== undefined ? item.bh : '',
        item.bi !== undefined ? item.bi : '',
        item.bj !== undefined ? item.bj : '',
        item.bk !== undefined ? item.bk : ''
      ]);
    }
    sheet.getRange(group[0].row, CONFIG_RESULT_COL_START, rowsCount, CONFIG_RESULT_COL_COUNT)
         .setValues(matrix);
  }
}
