import { type ProgramConfig } from "../../../types/programConfig/ProgramConfig";
import { getDisplayName } from "../../helpers/getDisplayNameByOption";

export type SortOrder = "asc" | "desc"

export interface TableSort {
    orderBy: string
    order: SortOrder
}

const isEmpty = (value: unknown) => value === undefined || value === null || value === ""

// Sorts table rows by one column. Option-set values are compared by their label (what the
// user sees), numbers and codes numerically ("Grade 2" before "Grade 10"), empty values last.
// `program` is the page's program config (any ProgramConfig shape with stages and attributes)
export function sortTableRows<T extends Record<string, any>>(rows: T[], sort?: TableSort, program?: unknown): T[] {
    if (!sort?.orderBy) return rows;

    const { orderBy, order } = sort;
    const sortValue = (row: T) => {
        const value = row?.[orderBy];
        if (isEmpty(value) || !program) return value;
        return getDisplayName({ metaData: orderBy, value: String(value), program: program as ProgramConfig });
    };

    return rows
        .map((row) => ({ row, value: sortValue(row) }))
        .sort((a, b) => {
            const aEmpty = isEmpty(a.value);
            const bEmpty = isEmpty(b.value);
            if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;

            const cmp = String(a.value).localeCompare(String(b.value), undefined, { numeric: true, sensitivity: "base" });
            return order === "asc" ? cmp : -cmp;
        })
        .map(({ row }) => row);
}
