import { useDataEngine } from '@dhis2/app-runtime';
import { validateEnrollmentYear } from '../../utils/validateEnrollmentYear';

export function useEnrollmentYearValidation() {
    const engine = useDataEngine();

    return async ({ students, enrollmentYear, dataStore, calendars = [], sectionType }: {
        students: { trackedEntity?: string; values?: Record<string, any>; enrollmentYear?: unknown }[];
        enrollmentYear?: unknown;
        dataStore: any;
        calendars?: any[];
        sectionType: string;
    }) => {
        if (sectionType?.toLowerCase() !== 'student') return;
        const attribute = dataStore?.admission?.academicYearAttribute;
        // Installations without the admission workflow retain their existing behavior.
        if (!attribute) return;
        for (const student of students) {
            let admissionYear = student.values?.[attribute];
            if (student.trackedEntity) {
                // Use the saved admission year, rather than an editable enrollment field.
                const result: any = await engine.query({ student: {
                    resource: 'tracker/trackedEntities',
                    id: student.trackedEntity,
                    params: { fields: 'attributes[attribute,value]', program: dataStore.program },
                } });
                admissionYear = result.student?.attributes?.find((a: any) => a.attribute === attribute)?.value;
            }
            const message = validateEnrollmentYear({
                enrollmentYear: student.enrollmentYear ?? enrollmentYear,
                admissionYear,
                calendars,
            });
            if (message) throw new Error(message);
        }
    };
}
