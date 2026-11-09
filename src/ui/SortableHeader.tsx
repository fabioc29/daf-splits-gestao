import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";

/** Estado de ordenação de uma tabela: clicar na mesma coluna inverte a direção. */
export function useTableSort<K extends string>(initialKey: K, initialDirection: SortDirection = "asc") {
  const [sort, setSort] = useState<{ key: K; direction: SortDirection }>({
    key: initialKey,
    direction: initialDirection,
  });
  function toggle(key: K, firstDirection: SortDirection = "asc") {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: firstDirection },
    );
  }
  return { sort, toggle };
}

export function compareValues(a: unknown, b: unknown, direction: SortDirection) {
  const factor = direction === "asc" ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * factor;
  return String(a ?? "").localeCompare(String(b ?? ""), "pt-BR", { sensitivity: "base", numeric: true }) * factor;
}

export function SortableHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  firstDirection = "asc",
  align = "left",
}: {
  label: string;
  sortKey: K;
  sort: { key: K; direction: SortDirection };
  onSort: (key: K, firstDirection?: SortDirection) => void;
  firstDirection?: SortDirection;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={"sortableTh" + (align === "right" ? " alignRight" : "")}
    >
      <button
        type="button"
        className={"sortButton" + (active ? " active" : "")}
        onClick={() => onSort(sortKey, firstDirection)}
      >
        {label}
        <Icon aria-hidden="true" />
      </button>
    </th>
  );
}
