import { useRecoilState } from "recoil";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDataQuery } from "@dhis2/app-runtime";
import useShowAlerts from "../../commons/useShowAlert";
import { ProgramRulesConfigState } from "../../../schema/programRulesSchema";
import { ProgramRuleConfig } from "../../../types/programRules/ProgramRulesTypes";
import { useCacheData } from "../../../hooks/useCacheData/useCacheData";

const PROGRAM_RULES_QUERY = {
    results: {
        resource: "programRules",
        params: ({ programFilter }: any) => ({
            paging: false,
            filter: programFilter,
            fields: "id,displayName,condition,description,program[id],programStage[id],priority,programRuleActions[id,content,location,data,programRuleActionType,programStageSection[id],dataElement[id],trackedEntityAttribute[id],option[id],optionGroup[id],programIndicator[id],programStage[id]]",

        })
    }
}

type ProgramRulesQueryResponse = {
    results: {
        programRules: ProgramRuleConfig[]
    }
}

export function useGetProgramRules(programs: string[]):any {
    const { hide, show } = useShowAlerts()
    const { getDataFromDB, saveDataToDB } = useCacheData();
    const [error, setError] = useState<boolean>(false)
    const [, setProgramRulesConfigState] = useRecoilState(ProgramRulesConfigState);
    const fetchedFilterRef = useRef<string | null>(null);

    const programFilter = useMemo(() => {
        const normalizedPrograms = Array.from(new Set((programs || []).filter(Boolean))).sort();
        if (normalizedPrograms.length === 0) return "";
        return `program.id:in:[${normalizedPrograms.join(",")}]`;
    }, [programs]);

    const { data, loading: loadingPRules, refetch } = useDataQuery<ProgramRulesQueryResponse>(PROGRAM_RULES_QUERY, {
        variables: {
            programFilter
        },
        onError(error: { message: string }) {
            show({
                message: `${("Could not get program rules")}: ${error?.message}`,
                type: { critical: true }
            });
            setTimeout(hide, 5000);
            setError(true)
        },
        onComplete(response: { results: { programRules: any[] } }) {
            setProgramRulesConfigState(response?.results?.programRules);
            saveDataToDB({ id: 'programRules', data: response?.results?.programRules }, 'programRules');
        },
        lazy: true
    })

    useEffect(() => {
        (async () => {
            const cached = await getDataFromDB('programRules', 'programRules');
            if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
                setProgramRulesConfigState(cached.data);
            }

            if (!programFilter) return;
            if (fetchedFilterRef.current === programFilter) return;

            fetchedFilterRef.current = programFilter;
            void refetch({ programFilter });
        })();
    }, [programFilter])

    return { loadingPRules, refetch, errorPRules: error }
}
