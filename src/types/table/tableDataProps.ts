import { attendanceConfig } from "./FormatRowsDataTypes";
import { type TableSort } from "../../utils/table/sort/sortTableRows";

type TableDataProps = Record<string, string>;

interface GetTableDataProps {
    page?: number
    pageSize?: number
    program: string
    order?: string
    orgUnit: string
    baseProgramStage: string
    otherProgramStage?: string
    attributeFilters?: string[]
    dataElementFilters?: string[]
    occurredAfter?: string
    occurredBefore?: string
    attendanceConfig?: attendanceConfig
    paging?: boolean
    skipPaging?: boolean
    academicYear?: string
    enrollmentStatusAcademicYear?: string
    academicYearDataElement?: string
    filterAdmissionByEventAcademicYear?: boolean
    ouMode?: string
    transferConfig?: {
        transferProgramStage: string
        destinySchoolDataElement: string
    }
    // When set, the full filtered list is loaded once and sorted/paged in the browser
    // `program` lets option-set columns sort by label
    sort?: TableSort & { program?: unknown }
}

interface GetAttendanceDataProps {
    tei: string
    selectedDate: any
}

export type { TableDataProps, GetTableDataProps, GetAttendanceDataProps }
