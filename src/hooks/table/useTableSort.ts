import { useState } from "react";
import { type TableSort } from "../../utils/table/sort/sortTableRows";

// Sort state for a table header. Clicking a column sorts ascending, clicking it again toggles.
// `onSortChange` lets the page go back to the first page when the order changes.
export function useTableSort({ onSortChange }: { onSortChange?: () => void } = {}) {
    const [sort, setSort] = useState<TableSort | undefined>(undefined)

    const createSortHandler = (columnId: string) => () => {
        setSort((prev) => prev?.orderBy === columnId
            ? { orderBy: columnId, order: prev.order === "asc" ? "desc" : "asc" }
            : { orderBy: columnId, order: "asc" })
        onSortChange?.()
    }

    // Only columns whose values are loaded for every row can be sorted across the whole list
    const withSortableColumns = <C extends { id: string }>(columns: C[] = [], sortableKeys: Set<string>): C[] =>
        columns.map((column) => ({ ...column, sortable: sortableKeys.has(column.id) }))

    return {
        sort,
        order: sort?.order ?? "asc",
        orderBy: sort?.orderBy ?? "",
        createSortHandler,
        withSortableColumns,
    }
}
