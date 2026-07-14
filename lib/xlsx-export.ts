// 공용 엑셀 내보내기 헬퍼 — 관리자 패널들의 반복되던 "행 배열 → xlsx 다운로드" 로직을 통합
export async function exportRowsToExcel(
  rows: Record<string, unknown>[],
  filename: string,
  sheetName = "Sheet1",
): Promise<void> {
  if (rows.length === 0) return;
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0]).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? "").length)) + 2,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
