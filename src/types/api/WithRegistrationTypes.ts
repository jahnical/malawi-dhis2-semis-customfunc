interface TeiQueryProps {
    program: string
    pageSize?: number
    page?: number
    orgUnitMode?: string
    ouMode?: string
    trackedEntities?: string[] | string
    trackedEntity?: string
    orgUnit?: string
    order?: string
    paging?: boolean
    filter?: string | string[]
    totalPages?: boolean
}

interface TeiSearchQueryProps {
    program: string
    page?: number
    pageSize?: number
    orgUnitMode?: string
    orgUnit?: string
    order?: string
    filter?: string
}

interface attributesProps {
    attribute: string
    value: string
}

interface TeiQueryResults {
    results: {
        instances: [{
            trackedEntity: string
            attributes: attributesProps[]
            enrollments: [{
                enrollment: string
                orgUnit: string
                program: string
            }]
            programOwners: [{
                orgUnit: string
            }]
        }]
    }
}

export enum EnrollmentStatus {
    ACTIVE = 'ACTIVE',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}

export type { TeiQueryProps, TeiSearchQueryProps, TeiQueryResults, attributesProps }