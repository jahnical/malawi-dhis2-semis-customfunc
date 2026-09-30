import useShowAlerts from "../commons/useShowAlert";
import { useDataEngine } from "@dhis2/app-runtime";
import { type TeiQueryProps } from "../../types/api/WithRegistrationTypes";
import { convertTrackerQueryProps } from "../../utils/tracker-migration/trackersParamsMapping";
import { useTrackerApiVersion } from "../system/useTrackerApiVersion";

const TEI_QUERY = (queryProps: TeiQueryProps) => ({
    results: {
        resource: "tracker/trackedEntities",
        params: {
            fields: "trackedEntity,createdAt,orgUnit,attributes[attribute,value],enrollments[enrollment,orgUnit,program,status],programOwners[orgUnit]",
            ...queryProps
        }
    }
})

export function useGetCompleteTeis() {
    const engine = useDataEngine();
    const apiVersion = useTrackerApiVersion()

    async function getCompleteTeis(props: TeiQueryProps) {
        return await engine.query(TEI_QUERY(
            { ...convertTrackerQueryProps({ queryProps: props, apiVersion }) }
        ))
    }

    return { getCompleteTeis }
}