import { attendanceConfig } from "./FormatRowsDataTypes";

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
}

interface GetAttendanceDataProps {
    tei: string
    selectedDate: any
}

export type { TableDataProps, GetTableDataProps, GetAttendanceDataProps }
