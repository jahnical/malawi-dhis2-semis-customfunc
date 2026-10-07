import { calendarForAcademicYear, clampToAcademicYear } from "./calendarForAcademicYear"

const cal = (code: string, label: string, startDate: string, endDate: string, id = `id${code}`) =>
    ({ id, academicYear: { code, label, startDate, endDate } })
const calendars = [cal("2027", "2026-2027", "2026-09-14", "2027-07-16"), cal("2019", "2018-2019", "2018-09-10", "2019-07-19", "P6Q7R8S9T0a")]

describe("calendarForAcademicYear", () => {
    it("uses the academic year selected in the header, not the current year", () => {
        expect(calendarForAcademicYear(calendars, "2019", "2027")?.academicYear?.label).toBe("2018-2019")
    })
    it("matches the year by label or calendar id too", () => {
        expect(calendarForAcademicYear(calendars, "2018-2019", "2027")?.academicYear?.code).toBe("2019")
        expect(calendarForAcademicYear(calendars, "P6Q7R8S9T0a", "2027")?.academicYear?.code).toBe("2019")
    })
    it("falls back to the current year when no year is selected or the year is not in the calendar", () => {
        expect(calendarForAcademicYear(calendars, undefined, "2027")?.academicYear?.code).toBe("2027")
        expect(calendarForAcademicYear(calendars, "2010", "2027")?.academicYear?.code).toBe("2027")
        expect(calendarForAcademicYear(undefined, "2019", "2027")).toBeUndefined()
    })
})

describe("clampToAcademicYear", () => {
    const y2019 = calendars[1]
    it("moves a date after the year to its last day and keeps dates inside it", () => {
        expect(clampToAcademicYear(new Date(2026, 9, 2), y2019)).toEqual(new Date(2019, 6, 19))
        expect(clampToAcademicYear(new Date(2018, 7, 1), y2019)).toEqual(new Date(2018, 8, 10))
        expect(clampToAcademicYear(new Date(2019, 1, 4), y2019)).toEqual(new Date(2019, 1, 4))
    })
})
