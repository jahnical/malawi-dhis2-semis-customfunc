import useUploadEvents from "./useUploadEvents";
import { formatTrackerError, getTrackerErrors } from "../../utils/errors/trackerErrors";

export interface UploadEachResult<T> {
    saved: T[]
    failed: { item: T, reason: string }[]
}

// Saves each item (usually one learner) in its own request with atomicMode ALL, a few at a time.
// Each learner's changes then save together or not at all (e.g. last year's enrollment is never
// closed without the new one being created), and one rejected learner doesn't block the others.
export function useUploadEach() {
    const { uploadValues } = useUploadEvents()

    async function uploadEach<T>(items: T[], { toPayload, importStrategy = "CREATE_AND_UPDATE", names = {}, concurrency = 5 }: {
        toPayload: (item: T) => any
        importStrategy?: string
        names?: Record<string, string>
        concurrency?: number
    }): Promise<UploadEachResult<T>> {
        const saved: T[] = []
        const failed: { item: T, reason: string }[] = []
        let next = 0

        async function worker() {
            while (next < items.length) {
                const item = items[next++]
                try {
                    const response = await uploadValues(toPayload(item), "COMMIT", importStrategy, { atomicMode: "ALL", silent: true })
                    const errors = getTrackerErrors(response, names)
                    if (errors.length > 0) failed.push({ item, reason: errors.join("; ") })
                    else saved.push(item)
                } catch (error) {
                    failed.push({ item, reason: formatTrackerError(error, { names, fallback: "Could not save" }) })
                }
            }
        }

        await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
        return { saved, failed }
    }

    return { uploadEach }
}
