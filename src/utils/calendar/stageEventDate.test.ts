import { eventDateResolver, stageEventDate, stageDatesForYear } from "./stageEventDate"

const cal2019 = {
    academicYear: { startDate: "2018-09-10", endDate: "2019-07-19" },
    classPeriods: [{ startDate: "2019-04-15", endDate: "2019-07-19" }, { startDate: "2018-09-10", endDate: "2018-12-21" }, { startDate: "2019-01-14", endDate: "2019-03-29" }],
}

test("past year: term stages get their term's last day, others the year's last day", () => {
    const dateFor = eventDateResolver(cal2019, ["T1", "T2", "T3"], "2026-10-02")
    expect([dateFor("T1"), dateFor("T2"), dateFor("T3"), dateFor("FINAL"), dateFor(undefined)])
        .toEqual(["2018-12-21", "2019-03-29", "2019-07-19", "2019-07-19", "2019-07-19"])
})

test("current year: never after today; no calendar: today", () => {
    const cal = { academicYear: { endDate: "2027-07-16" }, classPeriods: [{ startDate: "2026-09-14", endDate: "2026-12-18" }] }
    expect(eventDateResolver(cal, ["T1"], "2026-10-02")("T1")).toBe("2026-10-02")
    expect(eventDateResolver(undefined, [], "2026-10-02")("FINAL")).toBe("2026-10-02")
    expect(stageEventDate(cal2019, ["T1", "T2", "T3"], "T2", "2026-10-02")).toBe("2019-03-29")
})

test("stageDatesForYear finds the year's calendar by code", () => {
    const calendars = [{ academicYear: { code: "2019", ...cal2019.academicYear }, classPeriods: cal2019.classPeriods }]
    const dateFor = stageDatesForYear(calendars, "2019", ["T1", "T2", "T3"], "2026-10-02")
    expect([dateFor("T1"), dateFor("FINAL")]).toEqual(["2018-12-21", "2019-07-19"])
    expect(stageDatesForYear(calendars, "2031", ["T1"], "2026-10-02")("T1")).toBe("2026-10-02")
})
