import { Modules } from 'dhis2-semis-types';
import { read, utils, WorkBook } from "xlsx";
import { restoreLongNumbers } from "../../utils/bulk/restoreLongNumbers";

const METADATA = "Metadata"
const VALIDATION = "Validation"
const Ids = "Ids"
const Attendance = "Attendance"

type Section = {
    start: number;
    end: number | null;
};
type Structure = Record<string, Section>;

export class useValidation {
    private module?: Modules
    private configData: any[] = [];
    private rawData: any;
    private SheetNames: string[] = [];
    private headerSectionSheets: any
    private headerVariablesSheets: Record<string, string>[] = []

    constructor(module?: Modules) {
        this.module = module;
    }

    getModule() {
        return this.module
    }

    setModule(module: Modules) {
        this.module = module;
    }

    async validation(file: File): Promise<{ mapping: any; module: any }> {
        return new Promise((resolve, reject) => {
            const reader: FileReader = new FileReader();
            const mappedData: any = [];


            reader.onload = (event) => {
                try {
                    // Parse the uploaded file
                    const data: Uint8Array = new Uint8Array(event.target?.result as any);
                    const workbook = read(data, {
                        type: 'array',
                        cellDates: false,
                        cellNF: false,
                        cellText: false,
                        raw: false
                    });

                    // Long IDs typed as numbers would otherwise be read as "2.0195E+13"
                    restoreLongNumbers(workbook);

                    // const sheetName = workbook.SheetNames[0];
                    // const worksheet = workbook.Sheets[sheetName];
                    // const rawData = utils.sheet_to_json(worksheet,
                    //     { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: "" });
                    // const configSheet = workbook.SheetNames[1];
                    // const configWorksheet = workbook.Sheets[configSheet];
                    // const configData = utils.sheet_to_json(configWorksheet);

                    // console.log(configData, "SHEET NAME")

                    // Convert Excel to JSON and validate the sheet structure
                    this.converterXlstoJson(workbook);
                    this.sheetValidation(workbook.SheetNames);

                    for (let i = 3; i < this.rawData.length; i++) {
                        const row = this.rawData[i];
                        const isEmptyRow = !row || row.every((cell: any) =>
                            cell === null || cell === undefined || cell === '' ||
                            (typeof cell === 'string' && cell.trim() === '')
                        );

                        if (!isEmptyRow) {
                            mappedData.push(this.mapDataWithKeys(
                                row,
                                this.headerVariablesSheets,
                                this.headerSectionSheets
                            ));
                        }
                    }

                    resolve({
                        mapping: mappedData,
                        module: this.module
                    });
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = (error) => {
                reject(error);
            };

            reader.readAsArrayBuffer(file);
        });
    }

    private converterXlstoJson(workbook: WorkBook) {

        /**
         * 
         * Compare the current working module with the attendance module
         */

        if (this.module === Modules.Attendance) {

            /**
             * Extract all sheet names from the workbook.
             */
            const sheetNames = workbook.SheetNames;

            /**
             * Identify and retrieve the configuration sheet (assumed to be the last sheet).
             */
            const configSheet = workbook.SheetNames[sheetNames.length - 1];
            const configWorksheet = workbook.Sheets[configSheet];

            /**
             * Format the structure of the headers in the first sheet for further processing.
             * This helps to define the start and end positions of different sections (e.g., attendance).
             */
            let headerSectionSheets: any = this.formatSectionStructure(
                utils.sheet_to_json(workbook.Sheets[sheetNames[1]], { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: "" })?.[0] as Record<string, string>[]
            );

            /**
             * Convert all rows in the first sheet to JSON format.
             */
            const allRawDataOnFirstSheet = utils.sheet_to_json(
                workbook.Sheets[sheetNames[1]],
                { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: "" }
            );

            /**
             * Exclude the first sheet and metadata from further processing.
             * Get the names of remaining sheets.
             */
            const newSheetNames = sheetNames.slice(1) as unknown as string[];

            /**
             * Array to store all additional attendance-related header data from other sheets.
             */
            const allOtherAttendanceHeaderData: string[] = [];

            /**
             * Loop through each sheet name in `newSheetNames` and collect attendance-related headers.
             */
            for (const sheetName of newSheetNames) {
                if ((sheetName !== METADATA) && (sheetName !== VALIDATION)) {
                    /**
                     * Format the structure of headers for the current sheet.
                     */
                    const localHeaderSectionSheets = this.formatSectionStructure(
                        utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: "" })?.[0] as Record<string, string>[]
                    );

                    /**
                     * Extract the attendance-related header data for the current sheet
                     * based on its start and end indices.
                     */
                    const headerData = utils.sheet_to_json(
                        workbook.Sheets[sheetName],
                        { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: "" }
                    )[2] as Array<string>;

                    const headerDataAttendance = headerData.slice(localHeaderSectionSheets[Attendance].start, localHeaderSectionSheets[Attendance].end!);

                    /**
                     * Append the extracted headers to the `allOtherAttendanceHeaderData` array.
                     */
                    allOtherAttendanceHeaderData.push(...headerDataAttendance);
                }
            }

            /**
             * Loop through the rows (starting from the 4th row) in the first sheet to append attendance data.
             */
            for (let i = 3; i < allRawDataOnFirstSheet.length; i++) {
                const allAttendanceData: string[] = [];
                let attendanceData: any = [];

                for (const sheetName of newSheetNames) {
                    if ((sheetName !== METADATA) && (sheetName !== VALIDATION)) {
                        /**
                         * Format the structure of headers for the current sheet.
                         */
                        const localHeaderSectionSheets = this.formatSectionStructure(
                            utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: "" })?.[0] as Record<string, string>[]
                        );

                        /**
                         * Extract the attendance data for the current row and append it.
                         */
                        const currentData: Array<string> = utils.sheet_to_json(
                            workbook.Sheets[sheetName],
                            { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: "" }
                        );

                        attendanceData = currentData[i].slice(localHeaderSectionSheets[Attendance].start, localHeaderSectionSheets[Attendance].end!);

                        allAttendanceData.push(...attendanceData);
                    }
                }

                /**
                 * Insert the attendance data into the current row of the first sheet.
                 */
                (allRawDataOnFirstSheet[i] as any[]).splice(headerSectionSheets[Attendance].end!, 0, ...allAttendanceData);
            }

            /**
             * Generate an array of placeholders for new headers, matching the length of additional attendance data.
             */
            const newHeaders = Array(allOtherAttendanceHeaderData.length).fill(""); // Replace "" with actual values if needed

            /**
             * Append placeholders and attendance headers into the first three rows of the first sheet.
             */
            (allRawDataOnFirstSheet[0] as any[]).splice(headerSectionSheets[Attendance].end!, 0, ...newHeaders);
            (allRawDataOnFirstSheet[1] as any[]).splice(headerSectionSheets[Attendance].end!, 0, ...allOtherAttendanceHeaderData);
            (allRawDataOnFirstSheet[2] as any[]).splice(headerSectionSheets[Attendance].end!, 0, ...allOtherAttendanceHeaderData);

            /**
             * Update the end index of the attendance section to reflect the addition of new headers.
             */
            headerSectionSheets[Attendance].end = (headerSectionSheets[Attendance].end! as number) + allOtherAttendanceHeaderData.length;

            /**
             * Extract the updated attendance header data from the first sheet.
             */
            const attendanceHeaderData = utils.sheet_to_json(
                workbook.Sheets[sheetNames[0]],
                { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: "" }
            )?.[1] as string[];

            attendanceHeaderData.splice(headerSectionSheets[Attendance].end!, 0, ...allOtherAttendanceHeaderData);

            /**
             * Update the class-level properties with the processed data.
             */
            this.headerSectionSheets = this.formatSectionStructure(allRawDataOnFirstSheet[0]);
            this.headerVariablesSheets = allRawDataOnFirstSheet[2] as Record<string, string>[];
            this.SheetNames = sheetNames;
            this.configData = utils.sheet_to_json(configWorksheet);
            this.rawData = allRawDataOnFirstSheet;


        } else {

            /**
             * Get the first sheet in the workbook in cases of single sheet and convert it as a json
             * set to the global variables
             */
            const sheetName = workbook.SheetNames[1];
            const worksheet = workbook.Sheets[sheetName];
            const configSheet = workbook.SheetNames[2];
            const configWorksheet = workbook.Sheets[configSheet];


            this.headerVariablesSheets = utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: "" })?.[2] as Record<string, string>[];
            this.headerSectionSheets = this.formatSectionStructure(utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: "" })?.[0] as Record<string, string>[]);
            this.rawData = utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: "" });
            this.configData = utils.sheet_to_json(configWorksheet);
            this.SheetNames = workbook.SheetNames;
        }

    }

    private sheetValidation(sheets: string[]) {
        /**
         * Verify that the metadata sheet is present
         * if the metadata sheet is not present, return false and stop the process
         */
        if (!sheets.includes(METADATA)) {
            throw new Error("The metadata sheet is missing");
        }

        /**
         * Verify that there are at least two sheets
         * if there are less than two sheets, return false and stop the process
         */
        if (sheets.length < 2) {
            throw new Error("There are less than two sheets");
        }
        return true;
    }

    private validationAccordingModule() {

    }

    formatSectionStructure(data: any): Record<string, Section> {
        const structure: Record<string, Section> = {};
        let currentSection: string | null = null;
        let startIndex: number | null = null;

        data.forEach((value: string, index: number) => {
            if (value) {
                // Se já houver uma seção ativa, finalize-a
                if (currentSection !== null) {
                    structure[currentSection].end = index;
                }

                // Iniciar uma nova seção
                currentSection = value;
                startIndex = index;
                structure[currentSection!] = { start: startIndex!, end: null };
            }
        });

        // Finalizar a última seção, se houver
        if (currentSection !== null) {
            structure[currentSection].end = data.length;
        }

        return structure;
    }

    mapDataWithKeys(
        data: any,
        keys: any,
        structure: Structure
    ): Record<string, Record<string, string>> {
        const mappedData: Record<string, Record<string, string>> = {};

        for (const section in structure) {
            const { start, end } = structure[section];
            const sectionData = data.slice(start, end!);
            const sectionKeys = keys.slice(start, end!);

            mappedData[section] = sectionData.reduce((acc: Record<string, string>, value: string, index: number) => {
                acc[sectionKeys[index]] = value;
                return acc;
            }, {} as Record<string, string>);
        }

        return mappedData;
    }

}
