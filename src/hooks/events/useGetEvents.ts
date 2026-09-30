import useShowAlerts from "../commons/useShowAlert";
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

export function useGetEvents() {
    const engine = useDataEngine()
    const { hide, show } = useShowAlerts()
    const apiVersion = useTrackerApiVersion()

    async function getEvents(props: EventQueryProps): Promise<any> {
        const queries = convertEventQueryProps({ queryProps: props, apiVersion })
        return await Promise.all(queries.map((query) => engine.query(EVENT_QUERY(query))))
            .then(mergeEventResponses)
            .then((resp: any) => {
                return resp.results?.instances ? resp.results?.instances : resp.results?.events
            }).catch((error: any) => {
                show({ message: `Occurred error wihile fetching data: ${error}`, type: { critical: true } })
                setTimeout(hide, 5000);
            })
    }

    return { getEvents }
}
