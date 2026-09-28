import { format } from "date-fns";
import { HolidayType, type schoolCalendar } from "../../types/attendance/attendaceFormaterProps";
import useSectionProfile from "../commons/useSectionProfile";

export const unavailableSchoolDays = () => {
    const { attendanceWithinClassPeriods } = useSectionProfile()
    const normalize = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    function unavailableDays(date: Date, config: schoolCalendar) {
        if (isHoliday(date, config?.holidays)) {
            return true
        }

        if (isweekDayDisabled(date, config?.weekDays)) {
            return true
        }

        if (attendanceWithinClassPeriods) {
            if (isClassPeriod(normalize(new Date(date)), config?.classPeriods) && isClassPeriod(normalize(new Date(date)), [{ startDate: config?.academicYear?.startDate, endDate: config?.academicYear?.endDate }])) {
                return false
            } else return true
        }

        if (isClassPeriod(date, [{ startDate: config?.academicYear?.startDate, endDate: config?.academicYear?.endDate }])) {
            return false
        }

        return true
    }

    function isweekDayDisabled(date: Date, weekdays: Record<string, boolean>) {
        if (!weekdays?.[WeekDays?.[date?.getDay()]]) {
            return true
        }
    }

    function isHoliday(date: Date, holidays: HolidayType[]) {
        const formatDate = format(date, "yyyy-MM-dd")

        if (holidays?.findIndex((h: any) => h.date === formatDate) > -1) {
            return true
        }
    }

    function isClassPeriod(date: Date, classPeriods: Array<{ startDate: string, endDate: string }>) {
        const response = classPeriods?.some(h => {
            const start = normalize(new Date(h.startDate));
            const end = normalize(new Date(h.endDate));
            return start <= date && date <= end;
        })

        return response
    }

    return {
        unavailableDays
    }
}

enum WeekDays {
    sunday = 0,
    monday = 1,
    tuesday = 2,
    wednesday = 3,
    thursday = 4,
    friday = 5,
    saturday = 6
}
