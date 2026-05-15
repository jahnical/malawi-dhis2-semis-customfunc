export const DataElementFieldType = {
    programStage: "executionDateLabel,programStageDataElements[displayInReports,compulsory,dataElement[id,displayName,valueType,optionSet[options[code~rename(value),displayName~rename(label)]]]],programStageSections[displayName,id,displayInReports,compulsory,dataElements[id,formName~rename(displayName),valueType,optionSet[options[code~rename(value),displayName~rename(label)]]]]",
    programStageSection: "executionDateLabel,programStageSections[displayName,id,displayInReports,compulsory,dataElements[id,formName~rename(displayName),valueType,optionSet[options[code~rename(value),displayName~rename(label)]]]]"
}
interface EventQueryProps {
    page?: number
    pageSize?: number
    orgUnitMode?: string
    program: string
    order?: string
    programStage?: string
    orgUnit?: string
    filter?: string[]
    filterAttributes?: string[]
    trackedEntities?: string | string[]
    trackedEntity?: string | string[]
    ouMode?: string
    occurredAfter?: string
    occurredBefore?: string
    fields?: string
    paging?: boolean
    enrollment?: string
    totalPages?: boolean
    enrollmentStatus?: string
}

interface DataValuesProps {
    dataElement: string
    value: string
}

interface EventQueryResults {
    results: {
        instances?: [{
            trackedEntity: string
            dataValues: dataValuesProps[]
        }],
        events?: [{
            trackedEntity: string
            dataValues: dataValuesProps[]
        }]
    }
}

interface TransferQueryResults {
    results: {
        instances: [{
            trackedEntity: string
            orgUnit: string
            dataValues: DataValuesProps[]
        }]
    }
}

interface AttendanceQueryResults {
    results: {
        instances: any
    }
}

interface CreateEventProps {
    teiDetails: any
    dataElementId: string
    dataElementValue: string
    typeField: string
    rowsData: any[]
    setTableData: any
    setselectedTerm: any
}


interface GetDataElementsProps {
    programStageId: string
    type?: keyof typeof DataElementFieldType
}

interface dataValuesProps {
    dataElement: string
    value: string
}



export type { GetDataElementsProps, dataValuesProps }

export type { EventQueryProps, EventQueryResults, DataValuesProps, TransferQueryResults, AttendanceQueryResults, CreateEventProps }