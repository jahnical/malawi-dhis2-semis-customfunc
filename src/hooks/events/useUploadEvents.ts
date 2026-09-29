import { useDataEngine } from "@dhis2/app-runtime";
import useShowAlerts from "../commons/useShowAlert";
import { formatTrackerError, getTrackerErrors } from "../../utils/errors/trackerErrors";

const postEvent: any = {
    resource: 'tracker',
    type: 'create',
    data: ({ data }: any) => data,
    params: ({ params }: any) => params
}

interface UploadOptions {
    // The caller reports errors itself (e.g. the bulk import summary)
    silent?: boolean
    // Shown before the server's reason, e.g. "Could not save attendance"
    errorMessage?: string
    // Attribute/data element names, so messages show "LIN" instead of an id
    names?: Record<string, string>
}

const useUploadEvents = ():any => {
    const engine = useDataEngine();
    const { show } = useShowAlerts();

    const params = {
        async: false,
        atomicMode: "OBJECT",
        reportMode: "FULL"
    }

    // Shows the server's actual reason (e.g. a duplicate LIN) instead of the HTTP status text.
    // With atomicMode OBJECT, DHIS2 can save some records and reject others while returning 200,
    // so rejections in a successful response are reported too.
    async function uploadValues(postData: any, importMode: string, importStrategy: string, options: UploadOptions = {}) {
        const { silent = false, errorMessage = "Could not save", names = {} } = options
        try {
            const response = await engine.mutate(postEvent, {
                variables: {
                    data: postData,
                    params: { ...params, importStrategy, importMode }
                }
            });
            const rejected = getTrackerErrors(response, names)
            if (!silent && rejected.length > 0) {
                show({ message: `${"Some records were not saved"}: ${formatTrackerError(response, { names })}`, type: { warning: true, duration: 15000 } })
            }
            return response;
        } catch (error) {
            if (!silent) {
                show({ message: `${errorMessage}: ${formatTrackerError(error, { names })}`, type: { critical: true, duration: 15000 } })
            }
            throw error
        }
    }

    return { uploadValues }
}

export default useUploadEvents
