import { useState, useEffect } from 'react'
import { Modules } from 'dhis2-semis-types';
import { BuildFormType } from 'src/types/form/BuildForm';
import { ProgramStageConfig } from '../../types/programStageConfig/ProgramStageConfig';
import { formatResponseAttributes } from '../../utils/attributes/formatResponseAttributes';
import { formatResponseDataElements } from '../../utils/dataElements/formatResponseDataElements';

export function useBuildForm({ dataStoreData, programData, module, schoolCalendar }: BuildFormType) {
    const [formData, setFormData] = useState<any[]>([])

    const buildForm = () => {
        if (Object.keys(dataStoreData)?.length && programData !== undefined) {
            const { programStages } = programData
            const { registration, 'socio-economics': socioEconomics, "final-result": final_result } = dataStoreData

            switch (module) {
                case Modules.Admission:
                    setFormData([formatResponseAttributes(programData)])
                    break;

                case Modules.Enrollment:
                    const registrationProgramStage = programStages?.find((element) => element?.id === registration.programStage) as unknown as ProgramStageConfig
                    const socioEconomicProgramStage = programStages?.find((element) => element?.id === socioEconomics?.programStage) as unknown as ProgramStageConfig

                    setFormData([formatResponseDataElements(registrationProgramStage, schoolCalendar), formatResponseAttributes(programData), formatResponseDataElements(socioEconomicProgramStage)])
                    break;

                case Modules.Attendance:

                    setFormData([])
                    break;

                case Modules.Final_Result:
                    const finalResultProgramStage = programStages?.find((element) => element?.id === final_result?.programStage) as unknown as ProgramStageConfig

                    setFormData([formatResponseDataElements(finalResultProgramStage, schoolCalendar)])
                    break;

                case Modules.Performance:

                    setFormData([])
                    break;

                case Modules.Transfer:

                    setFormData([])
                    break;
            }
        }
    }

    useEffect(() => {
        buildForm()
    }, [programData, module])

    return { formData }
}