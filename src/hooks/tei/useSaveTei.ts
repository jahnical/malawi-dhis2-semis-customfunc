import { useState } from "react";
import { useDataEngine } from "@dhis2/app-runtime"
import useShowAlerts from '../commons/useShowAlert';
import { formatTrackerError, getProgramNames } from "../../utils/errors/trackerErrors";

const SAVE_TEI: any = {
    resource: "tracker",
    type: 'create',
    data: ({ data }: any) => data,
    params: {
        async: false,
        importStrategy: 'CREATE_AND_UPDATE'
    }
}

export function useSaveTei():any {
    const engine = useDataEngine()
    const { show } = useShowAlerts()
    const [error, setError] = useState<boolean>()
    const [response, setResponse] = useState<any>()
    const [loading, setLoading] = useState<boolean>()

    // `program` lets error messages name the attribute (e.g. "LIN") instead of showing its id
    const saveTei = async ({ data, messages, handleComplete, program }: { data: any, messages: { error: string, sucess: string }, handleComplete?: () => void, program?: any }) => {
        setLoading(true)
        return await engine.mutate(SAVE_TEI, {
            variables: { data },
            onComplete: (response) => {
                setResponse(response)
                setLoading(false)
                show({ message: messages.sucess, type: { success: true } })

                if (handleComplete) {
                    handleComplete()
                }
            },
            onError: (error) => {
                setError(true)
                setLoading(false)
                // The server's reason (e.g. "Non-unique attribute value ...") rather than "Forbidden"
                show({
                    message: `${messages.error}: ${formatTrackerError(error, { names: getProgramNames(program) })}`,
                    type: { critical: true, duration: 15000 }
                });
            }
        })
    }

    return { saveTei, loading, error, response }
}