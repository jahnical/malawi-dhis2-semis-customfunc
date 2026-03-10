import { useState } from "react";
import { GetTableDataProps, TableDataProps } from "../../types/table/tableDataProps";
import { useModulesData } from "./useModulesData";
import { Modules } from "dhis2-semis-types";

export function useTableData({ module }: { module: Modules }) {
    const { getBasicData, getStageData, getAdmissionData } = useModulesData()
    const [loading, setLoading] = useState<boolean>(false)
    const [tableData, setTableData] = useState<{ data: TableDataProps[], pagination: any }>({ data: [], pagination: {} })

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
            const { formattedBasicTableData, pagination } = await getBasicData(updatedProps)

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


    return {
        getBasicData,
        getData,
        tableData,
        loading
    }
}
