import { useCallback, useState } from "react";
import useShowAlerts from "../commons/useShowAlert";
import { formatTrackerError } from "../../utils/errors/trackerErrors";
import { useDataEngine } from "@dhis2/app-runtime";


const DELETE_TRACKER_MUTATION = {
    resource: "tracker",
    type: 'create',
    data: ({ data }: { data: any }) => data,
    params: {
        async: false,
        importStrategy: "DELETE",
    },
}  as any;

const TRACKER_QUERY = {
    results: {
        resource: "tracker/trackedEntities",
        id: ({ id }: { id: string }) => id,
        params: {
            fields: "*",
        },
    },
} as any;

type DeleteTrackerCallbacks = {
    onComplete?: () => void;
    onError?: (error: unknown) => void;
};

const returnTrackerBody = (trackedEntity: any) => ({
    trackedEntities: [{
        ...trackedEntity,
        deleted: true,
    }]
});


export function useDeleteTEI(): any {
    const engine = useDataEngine();
    const { show } = useShowAlerts();
    const [error, setError] = useState<unknown>(null)
    const [loading, setLoading] = useState<boolean>(false)

    const deleteTEI = useCallback(
        async (enrollmentId: string, { onComplete, onError }: DeleteTrackerCallbacks = {}) => {
            setLoading(true);
            setError(null);

            try {
                const { results } = (await engine.query(TRACKER_QUERY, {
                    variables: { id: enrollmentId },
                }));

                if (!results) throw new Error("Tracked Entity not found");

                console.log(results)

                await engine.mutate(DELETE_TRACKER_MUTATION, {
                    variables: { data: returnTrackerBody(results) },
                });

                onComplete?.();
            } catch (err) {
                setError(err);
                // Without a handler the failure used to be silent; show the server's reason
                if (onError) onError(err);
                else show({ message: `${"Could not delete the record"}: ${formatTrackerError(err)}`, type: { critical: true, duration: 15000 } });
            } finally {
                setLoading(false);
            }
        },
        [engine]
    );

    // async function deleteTEI(trackedEntity: string, onComplete?: () => void, onError?: (error?: unknown) => void) {
    //     try {
    //         setLoading(true)
    //         const response = await engine.mutate(DELETE_TEI_MUTATION, { variables: { id: trackedEntity } });
    //         if (onComplete) {
    //             onComplete()
    //         }
    //         return response;
    //     } catch (error) {
    //         setError(error)
    //         if (onError) {
    //             onError(error)
    //         }
    //     } finally {
    //         setLoading(false)
    //     }
    // }

    return { deleteTEI, loading, error }
}