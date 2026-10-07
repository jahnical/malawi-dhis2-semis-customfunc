import { read, utils, write } from "xlsx";
import { restoreLongNumbers } from "./restoreLongNumbers";

// Same read options as useValidation
const readLikeImport = (data: ArrayBuffer) => read(new Uint8Array(data), { type: "array", cellDates: false, cellNF: false, cellText: false, raw: false })
const rows = (wb: ReturnType<typeof read>) => utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, dateNF: "yyyy-mm-dd", defval: "" }) as string[][]

function workbookWith(cells: unknown[][]) {
    const sheet = utils.aoa_to_sheet(cells, { cellDates: true, dateNF: "yyyy-mm-dd" })
    const wb = utils.book_new()
    utils.book_append_sheet(wb, sheet, "admission")
    return readLikeImport(write(wb, { type: "array", bookType: "xlsx" }))
}

describe("restoreLongNumbers", () => {
    it("restores the full digits of a long ID typed as a number in a General cell", () => {
        const wb = workbookWith([[20195001930001, 20195001930002]])
        expect(rows(wb)[0]).toEqual(["2.0195E+13", "2.0195E+13"]) // what the import used to read
        expect(restoreLongNumbers(wb)).toBe(2)
        expect(rows(wb)[0]).toEqual(["20195001930001", "20195001930002"])
    })

    it("leaves text, short numbers and date cells unchanged", () => {
        const wb = workbookWith([["20195001930003", 2019, 1.5, new Date(Date.UTC(2011, 8, 7))]])
        const before = rows(wb)[0]
        expect(restoreLongNumbers(wb)).toBe(0)
        expect(rows(wb)[0]).toEqual(before)
        expect(before.slice(0, 3)).toEqual(["20195001930003", "2019", "1.5"])
        expect(before[3]).not.toMatch(/E\+/)
    })
})
