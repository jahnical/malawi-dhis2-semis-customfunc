import { useState } from "react";
import { useDataEngine } from "@dhis2/app-runtime"
import { CustomAttributeProps } from "dhis2-semis-types";
import { useGetPatternCodeParams } from "./useGetPatternCodeParams";
import { GeneratedCodeType, PatternCodeQueryResults } from "../../types/api/GeneratedCodeTypes";

const TEI_ATTRIBUTES: any = {
    results: {
        resource: "trackedEntityAttributes",
        id: ({ id }: { id: string }) => `${id}/generate`,
        params: ({ params }: { params: object }) => ({
            ...params,
            expiration: 3
        })
    }
}

export const useGetPatternCode = () => {
    const engine = useDataEngine()
    const [error, setError] = useState(false)
    const [loadingCodes, setloadingCodes] = useState(false)
    const [value, setvalue] = useState<GeneratedCodeType>({})
    const { getPatternCodeParams } = useGetPatternCodeParams()

    async function returnPattern(variables: CustomAttributeProps[], orgUnit: string) {
        setloadingCodes(true)
        const patterns = []
        for (const variable of variables) {
            const { pattern = "", name: id }: CustomAttributeProps = variable
            let code: PatternCodeQueryResults = { results: { value: "" } }

            if (pattern?.length) {
                const params = await getPatternCodeParams({ pattern, orgUnit, params: {}, onFail: () => setError(true) })
                code = await engine.query(TEI_ATTRIBUTES, { variables: { id, params } }) as unknown as PatternCodeQueryResults
                console.log("Generated code for variable", id, ":", code?.results?.value);
                patterns.push({ [id]: code?.results?.value })
            }
        }
        const value = patterns.reduce((key, pattern) => ({ ...key, ...pattern }), {});

        setvalue(value);
        setloadingCodes(false)
    }

    return {
        errorLoading: error,
        returnPattern,
        loadingCodes,
        generatedVariables: value
    }
}
