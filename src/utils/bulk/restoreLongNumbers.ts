import type { WorkBook } from "xlsx";

/** Text that Excel's "General" format shows for a long number, such as "2.0195E+13". */
const SCIENTIFIC_NOTATION = /^[-+]?\d+(\.\d+)?E[-+]?\d+$/i

/**
 * Restores the full digits of long numbers in a parsed workbook.
 *
 * The bulk import reads cells as displayed text (`sheet_to_json` with `raw: false`), so that dates and
 * codes come through as typed. A long ID such as a LIN (20195001930001) typed into a "General" cell is
 * stored as a number and displayed as "2.0195E+13", which made every learner's ID identical (E1064).
 * For numeric cells whose displayed text is in scientific notation, this replaces that text with the
 * number's own digits. Other cells, including dates and numbers shown normally, are left as they are.
 *
 * Returns the number of cells changed. The workbook is changed in place.
 */
export function restoreLongNumbers(workbook: WorkBook): number {
    let changed = 0
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) continue
        for (const address of Object.keys(sheet)) {
            if (address.startsWith("!")) continue
            const cell = sheet[address] as { t?: string, v?: unknown, w?: string }
            if (cell?.t !== "n" || typeof cell.v !== "number" || !Number.isFinite(cell.v)) continue
            if (typeof cell.w !== "string" || !SCIENTIFIC_NOTATION.test(cell.w.trim())) continue
            cell.w = Number.isInteger(cell.v) ? BigInt(cell.v).toString() : String(cell.v)
            changed++
        }
    }
    return changed
}
