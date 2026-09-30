import { useRef, useState } from "react";
import { GetTableDataProps, TableDataProps } from "../../types/table/tableDataProps";
import { useModulesData } from "./useModulesData";
import { Modules } from "dhis2-semis-types";
import { sortTableRows } from "../../utils/table/sort/sortTableRows";

export function useTableData({ module }: { module: Modules }) {
    const { getBasicData, getStageData, getAdmissionData } = useModulesData()
    const [loading, setLoading] = useState<boolean>(false)
    const [tableData, setTableData] = useState<{ data: TableDataProps[], pagination: any }>({ data: [], pagination: {} })
    // Columns present in the basic rows (attributes + base stage). Only these can be sorted across
    // the whole list; stage columns (marks, attendance, final result) are fetched per page.
    const [sortableKeys, setSortableKeys] = useState<Set<string>>(new Set())
    const sortCache = useRef<{ queryKey: string, callKey: string, rows: any[] } | null>(null)

    // Sorted mode: load the full filtered list once, sort it here and cut out the requested page.
    // Changing only the page or the sort reuses the list; an identical call is a refetch and reloads.
    async function getSortedBasicPage(props: GetTableDataProps) {
        // Totals are output, not part of the query (some pages pass their whole pagination state)
        const { page = 1, pageSize = 50, sort, totalPages, totalElements, ...query } = props as GetTableDataProps & { totalPages?: number, totalElements?: number }
        const queryKey = JSON.stringify(query)
        const callKey = JSON.stringify({ page, pageSize, orderBy: sort?.orderBy, order: sort?.order })
        const cached = sortCache.current

        let rows: any[]
        if (cached && cached.queryKey === queryKey && cached.callKey !== callKey) {
            rows = cached.rows
        } else {
            const { formattedBasicTableData } = await getBasicData({ ...query, paging: false })
            rows = formattedBasicTableData
        }
        sortCache.current = { queryKey, callKey, rows }

        const sorted = sortTableRows(rows, sort, sort?.program)
        const start = (page - 1) * pageSize
        return {
            formattedBasicTableData: sorted.slice(start, start + pageSize),
            pagination: { page, pageSize, totalPages: Math.ceil(sorted.length / pageSize), totalElements: sorted.length }
        }
    }

    async function loadBasicData(props: GetTableDataProps) {
        if (props.sort?.orderBy && props.paging !== false) return await getSortedBasicPage(props)

        sortCache.current = null
        const result = await getBasicData(props)
        // Everything is loaded already (e.g. attendance), so sort in place
        const formattedBasicTableData = props.sort?.orderBy
            ? sortTableRows(result.formattedBasicTableData, props.sort, props.sort.program)
            : result.formattedBasicTableData
        return { ...result, formattedBasicTableData }
    }

    async function getData(tableDataProps: GetTableDataProps) {
        setLoading(true);
        const updatedProps = {
            ...tableDataProps,
            ...(module == Modules.Transfer ?
                {
                    baseProgramStage: tableDataProps.otherProgramStage,
                    otherProgramStage: tableDataProps.baseProgramStage
                } : {})
        };

        try {
            if (module === Modules.Admission) {
                const { formattedBasicTableData: admissionData, pagination: admissionPagination } = await getAdmissionData(updatedProps);
                setTableData({ pagination: admissionPagination, data: [...admissionData] });
            } else {
            const { formattedBasicTableData, pagination } = await loadBasicData(updatedProps)
            setSortableKeys(new Set(formattedBasicTableData.flatMap((row: Record<string, any>) => Object.keys(row))))

            switch (module) {
                case Modules.Enrollment: {
                    setTableData({ pagination: pagination, data: [...formattedBasicTableData] });
                    break;
                }
                case Modules.Performance: case Modules.Final_Result: case Modules.Attendance: case Modules.Transfer: {
                    const { otherProgramStage, ...rest } = updatedProps;
                    if (otherProgramStage) {
                        const { formattedStagedData } = await getStageData({
                            formattedBasicTableData,
                            tableDataProps: { ...rest, baseProgramStage: otherProgramStage! },
                            module
                        });
                        setTableData({ pagination: pagination, data: [...formattedStagedData] });
                        return { data: [...formattedStagedData], pagination }
                    } else {
                        setTableData({ pagination: pagination, data: [...formattedBasicTableData] });
                        return { data: [...formattedBasicTableData], pagination }
                    }
                }
                default: {
                    console.error("Invalid module key provided");
                    break;
                }
            }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }

    }


    // Patches a single row in local state, no network call - for updates already known
    // client-side (e.g. a value auto-computed from another field just saved), so the table
    // doesn't need a full reload to reflect them.
    function updateRow(matcher: (row: Record<string, any>) => boolean, patch: Record<string, any>) {
        setTableData(prev => ({
            ...prev,
            data: prev.data.map(row => matcher(row) ? { ...row, ...patch } : row)
        }))
    }

    return {
        getBasicData,
        getData,
        tableData,
        loading,
        sortableKeys,
        updateRow
    }
}
