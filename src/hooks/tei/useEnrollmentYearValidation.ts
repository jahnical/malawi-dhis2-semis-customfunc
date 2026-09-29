import { useDataEngine } from '@dhis2/app-runtime';
import { useState } from 'react';
import { validateEnrollmentYear } from '../../utils/validateEnrollmentYear';

export function useEnrollmentYearValidation() {
    const engine = useDataEngine();
    const [fieldError, setFieldError] = useState<{ year: unknown; message: string }>();

    const validate = async ({ students, enrollmentYear, dataStore, calendars = [], sectionType, programConfig }: {
        students: { trackedEntity?: string; values?: Record<string, any>; enrollmentYear?: unknown }[];
        enrollmentYear?: unknown;
        dataStore: any;
        calendars?: any[];
        sectionType: string;
        programConfig?: any;
    }) => {
        setFieldError(undefined);
        if (sectionType?.toLowerCase() !== 'student') return;
        try {
        const attribute = dataStore?.admission?.admissionDate;
        if (!attribute) throw new Error('The admission date attribute must be configured before enrolling students.');
        for (const student of students) {
            let admissionDate = student.values?.[attribute];
            if (student.trackedEntity) {
                // Always read the saved admission date for an existing student.
                const result: any = await engine.query({ student: {
                    resource: 'tracker/trackedEntities',
                    id: student.trackedEntity,
                    params: { fields: 'attributes[attribute,value]', program: dataStore.program },
                } });
                admissionDate = result.student?.attributes?.find((a: any) => a.attribute === attribute)?.value;
            }
            const selectedYear = student.enrollmentYear ?? enrollmentYear;
            const yearOptions = programConfig?.programStages?.flatMap((stage: any) => stage.programStageDataElements ?? [])
                .find((item: any) => item.dataElement?.id === dataStore.registration?.academicYear)?.dataElement?.optionSet?.options ?? [];
            const message = validateEnrollmentYear({
                enrollmentYear: selectedYear,
                admissionDate,
                calendars,
                options: yearOptions,
            });
            if (message === 'Select a valid enrollment academic year.') {
                // Diagnose configuration/value mismatches without logging student data.
                console.warn('[Enrollment academic year diagnostic]', JSON.stringify({
                    selectedYear: selectedYear ?? null,
                    valueType: typeof selectedYear,
                    academicYearField: dataStore.registration?.academicYear ?? null,
                    options: yearOptions.map((option: any) => ({ value: option.value ?? option.code, label: option.label ?? option.displayName })),
                    calendars: calendars.map((calendar: any) => calendar.academicYear),
                }));
            }
            if (message) throw new Error(message);
        }
        } catch (error) {
            setFieldError({ year: enrollmentYear, message: error instanceof Error ? error.message : 'Could not verify the saved admission date. Please try again.' });
            throw error;
        }
    };
    return Object.assign(validate, {
        withFieldError: (sections: any[], fieldId: string, selectedYear: unknown, translate: (message: string) => string) =>
            (sections ?? []).map(section => ({
                ...section,
                fields: section.fields?.map((field: any) => field.id === fieldId && fieldError && fieldError.year === selectedYear
                    ? { ...field, error: true, content: translate(fieldError.message) }
                    : field),
            })),
    });
}
