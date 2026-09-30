import { useDataEngine } from "@dhis2/app-runtime";
import { EventQueryProps } from "../../types/api/WithoutRegistrationTypes";
import { convertEventQueryProps, mergeEventResponses } from "../../utils/tracker-migration/eventsParamsMapping";
import { useTrackerApiVersion } from "../system/useTrackerApiVersion";

const EVENT_QUERY = (queryProps: EventQueryProps) => ({
    results: {
        resource: "tracker/events",
        params: {
            fields: queryProps?.fields ?? "*",
            ...queryProps
        }
    }
})

export function useGetCompleteEvents() {
    const engine = useDataEngine()
    const apiVersion = useTrackerApiVersion()

    async function getCompleteEvents(props: EventQueryProps): Promise<any> {
        const queries = convertEventQueryProps({ queryProps: props, apiVersion })
        return mergeEventResponses(await Promise.all(queries.map((query) => engine.query(EVENT_QUERY(query)))))
    }

    return { getCompleteEvents }
}
