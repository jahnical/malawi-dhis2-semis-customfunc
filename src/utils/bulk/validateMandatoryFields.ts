import { getDateValidationIssue } from "../format/checkDateFormat";

const DATE_FORMAT_VALIDATION_ERROR = "Invalid date format. Expected YYYY-MM-DD"
const DATE_VALUE_VALIDATION_ERROR = "Invalid date value. Use a real date in YYYY-MM-DD"
const DATE_VALUE_TYPE = "DATE"

const madatoryFieldsValidator = (program: any, fileRowData: any, module: string, profile: string) => {
    const validData: any[] = []
    const invalidData: any[] = []
    const students = fileRowData
    const madatoryFieldsAttributes = program.programTrackedEntityAttributes.filter((field: any) => field.mandatory)
    const uniqueAttributes: any[] = program.programTrackedEntityAttributes.filter((attribute: any) => {
        return attribute.trackedEntityAttribute?.unique
    })


    students.forEach((student: any) => {
        const mandatoryAttributeErrors = validateMandatoryAttributtes(student, madatoryFieldsAttributes, profile)
        // Admission module only uses TEI attributes, not program stage data elements
        const mandatoryDataElementErrors = module === "admission" ? [] : validateMandatoryDataElements(student, program, profile)
        const invalidDateFormatErrors = validateDateFields(student, program, profile)

        if (mandatoryAttributeErrors.length === 0 && mandatoryDataElementErrors.length === 0 && invalidDateFormatErrors.length === 0) {
            validData.push({
                ...student,
                warnings: [...(validateAttendanceFields(module, student) || [])?.map((validateAttendanceField: any) => {
                    return { key: validateAttendanceField, error: "No attendance to this date" }
                }),
                ...(validatePerformanceFields(student, module, program) || []).map((field: any) => {
                    return {
                        key: `${field?.programStageName} - ${field?.displayName ?? field?.name}`,
                        error: "Empty required field"
                    }
                })
                ],
            })
        } else {
            invalidData.push({
                ...student,
                errors: [
                    ...(validateOptionalFields(student, module, program) || []).map((field: any) => {
                        return {
                            key: `${field?.displayName ?? field?.name}`,
                            error: "Empty required field"
                        }
                    }),
                    ...mandatoryAttributeErrors.map((field: any) => { return { key: field?.displayName ?? field?.name, error: "Empty required field" } }),
                    ...mandatoryDataElementErrors.map((field: any) => { return { key: field, error: "Empty required field" } }),
                    ...invalidDateFormatErrors]
            })
        }
    });
    return { validData, invalidData, uniqueAttributes }
}

const validateMandatoryAttributtes = (student: any, madatoryFieldsAttributes: any, profile: string): [] => {
    //FILTER ALL NULL, UNDEFINED AND EMPTY ATTRIBUTES
    console.log(student, madatoryFieldsAttributes)
    return madatoryFieldsAttributes.filter(({ trackedEntityAttribute: { id } }: any) => {
        const value = student?.[profile]?.[id];
        return value === undefined || value === null || value === '';
    });
}

const validateMandatoryDataElements = (student: any, program: any, profile: string): [] => {
    //GET ALL PROGRAM STAGES WITH AT LEAST ONE MANDATORY DATA ELEMENT
    const madatoryFieldsProgramStages = program?.programStages.map((programStage: any) => {
        const compulsoryElements = programStage.programStageDataElements.filter((el: any) => el.compulsory);
        if (compulsoryElements.length === 0) return null;
        return {
            name: programStage.name,
            id: programStage.id,
            programStageDataElements: compulsoryElements
        };
    }).filter(Boolean)


    // FILTER ALL STUDENT FILE PROGRAM STAGES AND MERGE ON ONE OBJECT
    const filteredObjects = Object.entries(student)
        .filter(([key]) => key !== profile && key !== "Ids")
        .map(([_, value]) => value);
    const merged = Object.assign({}, ...filteredObjects);

    return madatoryFieldsProgramStages
        .map((stage: any) =>
            //FILTER ALL NULL, UNDEFINED AND EMPTY DATA ELEMENTS
            stage.programStageDataElements.filter(({ dataElement }: any) => {
                const fullId = `${stage.id}.${dataElement.id}`;
                const value = merged[fullId];
                return value === undefined || value === null || value === '';
            }).map(({ dataElement }: any) => dataElement?.displayName ?? dataElement?.name)
        ).flat();
}

const validateDateFields = (student: any, program: any, profile: string) => {
    const dateErrors: Array<{ key: string, error: string }> = []
    const profileValues = student?.[profile] ?? {}
    const mergedStageValues = Object.assign(
        {},
        ...Object.entries(student)
            .filter(([key]) => key !== profile && key !== "Ids")
            .map(([_, value]) => value)
    )

    for (const programAttribute of (program?.programTrackedEntityAttributes ?? [])) {
        const trackedEntityAttribute = programAttribute?.trackedEntityAttribute
        if (trackedEntityAttribute?.valueType !== DATE_VALUE_TYPE) continue

        const value = profileValues?.[trackedEntityAttribute?.id]
        if (value === undefined || value === null || value === '') continue

        const issue = getDateValidationIssue(String(value))
        if (issue) {
            dateErrors.push({
                key: trackedEntityAttribute?.displayName ?? trackedEntityAttribute?.name,
                error: issue === "FORMAT" ? DATE_FORMAT_VALIDATION_ERROR : DATE_VALUE_VALIDATION_ERROR
            })
        }
    }

    for (const programStage of (program?.programStages ?? [])) {
        for (const programStageDataElement of (programStage?.programStageDataElements ?? [])) {
            const dataElement = programStageDataElement?.dataElement
            if (dataElement?.valueType !== DATE_VALUE_TYPE) continue

            const value = mergedStageValues?.[`${programStage?.id}.${dataElement?.id}`]
            if (value === undefined || value === null || value === '') continue

            const issue = getDateValidationIssue(String(value))
            if (issue) {
                dateErrors.push({
                    key: `${programStage?.displayName ?? programStage?.name} - ${dataElement?.displayName ?? dataElement?.name}`,
                    error: issue === "FORMAT" ? DATE_FORMAT_VALIDATION_ERROR : DATE_VALUE_VALIDATION_ERROR
                })
            }
        }
    }

    // "enrollmentDate" is a template/system field used to build enrollment payload dates.
    for (const [section, sectionValues] of Object.entries(student ?? {})) {
        if (section === profile || section === "Ids") continue

        const enrollmentDate = (sectionValues as any)?.enrollmentDate
        if (enrollmentDate === undefined || enrollmentDate === null || enrollmentDate === '') continue

        const issue = getDateValidationIssue(String(enrollmentDate))
        if (issue) {
            dateErrors.push({
                key: `${section} - enrollmentDate`,
                error: issue === "FORMAT" ? DATE_FORMAT_VALIDATION_ERROR : DATE_VALUE_VALIDATION_ERROR
            })
        }
    }

    return dateErrors
}

const validateAttendanceFields = (module: string, student: any) => {
    if (module === "attendance") {
        const emptyEntries = Object.keys(student?.Attendance).filter(key => student?.Attendance[key] === ""
            || student?.Attendance[key] === null || student?.Attendance[key] === undefined
        );
        return emptyEntries;
    }
}

const validateOptionalFields = (student: any, module: string, program: any) => {
    const warningRecords: any = []
    //GET ALL PROGRAM STAGES WITH AT LEAST ONE MANDATORY DATA ELEMENT
    const nonMandatoryFieldsDataElements = program?.programStages.flatMap((programStage: any) =>
        programStage.programStageDataElements
            .filter((el: any) => !el.compulsory)
            .map((el: any) => ({
                ...el.dataElement,
                compulsory: el.compulsory,
                programStageId: programStage?.id,
                programStageName: programStage?.name ?? programStage?.displayName
            }))
    );

    if (module === "final-result") {
        const allEmpty = Object.keys(student?.['Final result']).filter(key => student?.['Final result'][key] === ""
            || student?.['Final result'][key] === null || student?.['Final result'][key] === undefined
        );

        allEmpty.forEach((key: any) => {
            warningRecords.push(nonMandatoryFieldsDataElements?.filter((field: any) => `${field?.programStageId}.${field?.id}` === key)?.[0])
        })
    }
    return warningRecords
}

const validatePerformanceFields = (student: any, module: string, program: any) => {
    const warningRecords: any = []
    //GET ALL PROGRAM STAGES WITH AT LEAST ONE MANDATORY DATA ELEMENT
    const nonMandatoryFieldsDataElements = program?.programStages.flatMap((programStage: any) =>
        programStage.programStageDataElements
            .filter((el: any) => !el.compulsory)
            .map((el: any) => ({
                ...el.dataElement,
                compulsory: el.compulsory,
                programStageId: programStage?.id,
                programStageName: programStage?.name ?? programStage?.displayName
            }))
    );

    if (module === "performance") {
        const emptyTerm1 = Object.keys(student?.['Term 1']).filter(key => student?.['Term 1'][key] === ""
            || student?.['Term 1'][key] === null || student?.['Term 1'][key] === undefined
        );

        const emptyTerm2 = Object.keys(student?.['Term 2']).filter(key => student?.['Term 2'][key] === ""
            || student?.['Term 2'][key] === null || student?.['Term 2'][key] === undefined
        );

        const emptyTerm3 = Object.keys(student?.['Term 3']).filter(key => student?.['Term 3'][key] === ""
            || student?.['Term 3'][key] === null || student?.['Term 3'][key] === undefined
        );

        emptyTerm1.forEach((key: any) => {
            warningRecords.push(nonMandatoryFieldsDataElements?.filter((field: any) => `${field?.programStageId}.${field?.id}` === key)?.[0])
        })

        emptyTerm2.forEach((key: any) => {
            warningRecords.push(nonMandatoryFieldsDataElements?.filter((field: any) => `${field?.programStageId}.${field?.id}` === key)?.[0])
        })

        emptyTerm3.forEach((key: any) => {
            warningRecords.push(nonMandatoryFieldsDataElements?.filter((field: any) => `${field?.programStageId}.${field?.id}` === key)?.[0])
        })
    }
    return warningRecords
}

export { madatoryFieldsValidator }
