import { attributesProps } from "../api/WithRegistrationTypes"
import { dataValuesProps, DataValuesProps } from "../api/WithoutRegistrationTypes"


interface FormatResponseRowsProps {
    isBasicStage?: boolean
    registrationInstances?: {
        trackedEntity: string
        dataValues: dataValuesProps[]
        enrollment: string
        event?: string
        occurredAt?: string
        isRegistrationEvent?: boolean
    }[]
    teiInstances?: {
        trackedEntity: string
        attributes: attributesProps[]
        enrollments: {
            enrollment: string
            orgUnit: string
            program: string
            status: string
        }[]
        createdAt: string
        programOwners: {
            orgUnit: string
        }[]
    }[]
    socioEconInstances?: {
        trackedEntity: string
        dataValues: dataValuesProps[]
        enrollment: string
        event?: string
        occurredAt?: string
        isRegistrationEvent?: boolean
    }[]
    attendanceInstances?: {
        trackedEntity: string
        dataValues: DataValuesProps[]
        enrollment: string
        event?: string
        occurredAt?: string
        isRegistrationEvent?: boolean
    }[]
    additionalInstances?: any[]
    academicYear?: string
    enrollmentStatusAcademicYear?: string
    academicYearDataElement?: string
}

type RowsDataProps = Record<string, string | number | boolean | any>;

export type { FormatResponseRowsProps, RowsDataProps }
