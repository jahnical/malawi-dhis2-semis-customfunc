import { useState } from 'react';
import { useDataEngine } from "@dhis2/app-runtime"
import useShowAlerts from "../commons/useShowAlert"
import { CreateFileInterface, CreateFileInterfaceResponse } from '../../types/image/useFileResourceType';
import { useTrackerApiVersion } from '../system/useTrackerApiVersion';

const POSTFILERESOURCEMUTATION: any = {
    resource: "fileResources",
    data: ({ data }: any) => data,
    type: "create"
}

const DELETEFILERESOURCEMUTATION: any = {
    resource: "fileResources",
    id: ({ id }: any) => id,
    type: "delete"
}

const GETFILERESOURCEQUERY: any = ({ trackedEntity, attribute }: { trackedEntity: string, attribute: string }) => ({
    results: {
        resource: `trackedEntityInstances/${trackedEntity}/${attribute}/image`,
        params: {
            dimension: "MEDIUM"
        }
    }
})

const GETFILERESOURCEQUERYUP40: any = ({ trackedEntity, attribute, program }: { trackedEntity: string, attribute: string, program: string }) => ({
    results: {
        resource: `tracker/trackedEntities/${trackedEntity}/attributes/${attribute}/image`,
        params: {
            program: program,
            dimension: "MEDIUM"
        }
    }
})


export const useFileResource = () => {
    const engine = useDataEngine()
    const { hide, show } = useShowAlerts()
    const [loading, setloading] = useState(false)
    const apiVersion = useTrackerApiVersion()

    function showAlert(message: string, type: any) {
        setloading(false)
        show({
            message: message,
            type: type
        });
        setTimeout(hide, 5000);
    }

    async function createFileResource({ file }: CreateFileInterface): Promise<{ fileId: string }> {
        setloading(true)

        const postFile = await engine.mutate(POSTFILERESOURCEMUTATION, { variables: { data: { file: file } } }) as unknown as CreateFileInterfaceResponse

        const fileId = postFile.response.fileResource.id
        setloading(false)
        return { fileId }
    }

    async function getFileResource({ trackedEntity, attribute, program }: { trackedEntity: string, attribute: string, program: string }): Promise<{ file: any }> {
        if (trackedEntity && attribute) {
            setloading(true)
            let file: any = ""

            // /trackedEntityInstances was removed in 42; the tracker image endpoint exists from 41
            try {
                file = await engine.query(apiVersion < 41
                    ? GETFILERESOURCEQUERY({ trackedEntity, attribute })
                    : GETFILERESOURCEQUERYUP40({ trackedEntity, attribute, program }))
            } catch (error) {
                setloading(false)
            }
            setloading(false)

            return { file: file?.results }
        }
        return { file: null }
    }

    async function deleteFileResource(documentId: string): Promise<void> {
        setloading(true)
        await engine.mutate(DELETEFILERESOURCEMUTATION, {
            variables: { id: documentId },
            onError(error) {
                showAlert(`${("Could not delete image")}: ${error.message}`, { critical: true })
            },
            onComplete() {
                showAlert(`${("Successfully deleted image")}`, { success: true })
            }
        })

        setloading(false)
    }

    return {
        createFileResource,
        deleteFileResource,
        getFileResource,
        loading
    }
}