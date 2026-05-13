import { useRecoilState } from "recoil";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDataQuery } from "@dhis2/app-runtime";
import useShowAlerts from "../../commons/useShowAlert";
import { ProgramRulesVariablesConfigState } from "../../../schema/programRulesVariablesSchema";
import { ProgramRuleVariableConfig } from "../../../types/programRules/ProgramRulesTypes";
import { useCacheData } from "../../../hooks/useCacheData/useCacheData";

const PROGRAM_RULES_VARIABLES_QUERY = {
    results: {
        resource: "programRuleVariables",
        params: ({ programFilter }: any) => ({
            paging: false,
            filter: programFilter,
            fields: "name,dataElement,trackedEntityAttribute,program[id]",

        })
    }
}

type ProgramRulesVariablesQueryResponse = {
    results: {
        programRuleVariables: ProgramRuleVariableConfig[]
    }
}

export function useGetProgramRulesVariables(programs: string[]):any {
    const { hide, show } = useShowAlerts()
    const { getDataFromDB, saveDataToDB } = useCacheData();
    const [error, setError] = useState<boolean>(false)
    const [, setProgramRuleVariablesConfigState] = useRecoilState(ProgramRulesVariablesConfigState);
    const fetchedFilterRef = useRef<string | null>(null);

    const programFilter = useMemo(() => {
        const normalizedPrograms = Array.from(new Set((programs || []).filter(Boolean))).sort();
        if (normalizedPrograms.length === 0) return "";
        return `program.id:in:[${normalizedPrograms.join(",")}]`;
    }, [programs]);

    const { data, loading: loadingPRulesVariables, refetch } = useDataQuery<ProgramRulesVariablesQueryResponse>(PROGRAM_RULES_VARIABLES_QUERY, {
        variables: {
            programFilter
        },
        onError(error: { message: string }) {
            show({
                message: `${("Could not get program rules variables")}: ${error.message}`,
                type: { critical: true }
            });
            setTimeout(hide, 5000);
            setError(true)
        },
        onComplete(response: { results: { programRuleVariables: any[] } }) {
            setProgramRuleVariablesConfigState(response?.results?.programRuleVariables);
            saveDataToDB({ id: 'programRuleVariables', data: response?.results?.programRuleVariables }, 'programRuleVariables');
        },
        lazy: true
    })

    useEffect(() => {
        (async () => {
            const cached = await getDataFromDB('programRuleVariables', 'programRuleVariables');
            if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
                setProgramRuleVariablesConfigState(cached.data);
            }

            if (!programFilter) return;
            if (fetchedFilterRef.current === programFilter) return;

            fetchedFilterRef.current = programFilter;
            void refetch({ programFilter });
        })();
    }, [programFilter])

    return { loadingPRulesVariables, refetch, errorPRulesVariables: error }
}
