import { useState } from "react"
import { madatoryFieldsValidator } from "../../utils/bulk/validateMandatoryFields"
import { useDataEngine } from "@dhis2/app-runtime"
import { useUrlParams } from "../commons/useQueryParams";
import { useTrackerApiVersion } from "../system/useTrackerApiVersion";
import { convertTrackerQueryProps } from "../../utils/tracker-migration/trackersParamsMapping";

const checkTEI = async (engine: any, apiVersion: number, programId: string, ouID: string, filterParams: string[]): Promise<any[]> => {
    const queryResult = await engine.query({
        trackedEntities: {
            resource: 'tracker/trackedEntities',
            params: {
                ...convertTrackerQueryProps({
                    queryProps: { program: programId, orgUnit: ouID, orgUnitMode: "SELECTED", filter: filterParams },
                    apiVersion
                }),
                fields: 'trackedEntity,attributes,enrollments'
            }
        }
    });
    if (queryResult?.trackedEntities?.instances?.length > 0 || queryResult?.trackedEntities?.trackedEntities?.length > 0) {
        return queryResult?.trackedEntities?.instances ? queryResult?.trackedEntities?.instances : queryResult?.trackedEntities?.trackedEntities
    }
    return []
}

const useValidateFile = (program: any, mutateType: "POST" | "UPDATE") => {
    const [loader, setLoader] = useState<boolean>(false)
    const engine = useDataEngine()
    const apiVersion = useTrackerApiVersion()
    const [validRecords, setValidRecords] = useState<any[]>([])
    const [invalidRecords, setInvalidRecords] = useState<any[]>([])
    const { displayName } = program
    const { urlParameters } = useUrlParams()
    const { sectionType, school } = urlParameters
    const Profile = (sectionType ?? '').substring(0, 1).toUpperCase() + (sectionType ?? '').substring(1, (sectionType ?? '').length) + ' profile'

    const validador = async ({ module, data }: { module: string, data: any[] }) => {
        const { invalidData, uniqueAttributes, validData } = madatoryFieldsValidator(program, data, module, Profile)
        setInvalidRecords(invalidData)

        if (module !== "enrollment") {
            setValidRecords(validData)
        } else {
            setValidRecords(mutateType === "UPDATE" ? validData : [])
        }

        if (mutateType === "POST" && module === "enrollment") {
            const filterParams = validData.map((student: any) => {
                const params = uniqueAttributes.flatMap((attributes: any) => {
                    const value = student?.['Student profile']?.[attributes.trackedEntityAttribute.id]
                    return value ? [`${attributes.trackedEntityAttribute.id}:EQ:${value}`] : null
                })?.filter(x => x !== null)
                return { student, params }
            })

            setLoader(true)
            for (const params of filterParams) {

                let isValid = true;
                for (const param of params?.params) {
                    const instances: any[] = await checkTEI(engine, apiVersion, program.id, params?.student?.Ids?.orgUnit ?? school, [param])
                    if (instances.length > 0) {
                        setInvalidRecords(prevState => [
                            ...prevState,
                            {
                                ...params.student,
                                errors: [
                                    {
                                        key: `${displayName ?? sectionType}`,
                                        error: `already exists in the system`
                                    }
                                ]
                            }
                        ])
                        isValid = false
                        break
                    }
                }
                if (isValid) {
                    setValidRecords(prevState => [
                        ...prevState,
                        {
                            ...params.student,
                        }
                    ])
                }
            }
            setLoader(false)
        }
    }
    return { validador, loader, validRecords, invalidRecords }
}
export { useValidateFile }