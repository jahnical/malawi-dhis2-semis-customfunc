import { useState } from "react";
import { useDataEngine } from "@dhis2/app-runtime"
import useShowAlerts from '../commons/useShowAlert';
import { formatTrackerError, getProgramNames, getTrackerErrors } from "../../utils/errors/trackerErrors";

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
        setError(false)
        setResponse(undefined)
        try {
            const result: any = await engine.mutate(SAVE_TEI, { variables: { data } })
            // Tracker can return an unsuccessful import report with HTTP 200.
            if (getTrackerErrors(result).length || result?.status === 'ERROR' || result?.response?.status === 'ERROR') {
                throw result
            }
            setResponse(result)
            show({ message: messages.sucess, type: { success: true } })
            handleComplete?.()
            return result
        } catch (error) {
            setError(true)
            show({
                message: `${messages.error}: ${formatTrackerError(error, { names: getProgramNames(program), fallback: 'The operation failed. Please try again.' })}`,
                type: { critical: true, duration: 15000 }
            })
            // Errors are displayed here; callers close/reset their forms only in handleComplete.
            return undefined
        } finally {
            setLoading(false)
        }
    }

    return { saveTei, loading, error, response }
}
