import type {
	MagicBaseColumn,
	MagicBaseFilterCondition,
	MagicBaseFilterGroup,
	MagicBaseQueryRowsRequest,
	MagicBaseRow,
	MagicBaseSortRule,
	MagicBaseTable,
} from "@/apis/modules/magicBase"

export const MAGIC_BASE_PAGE_SIZE = 20
export const MAGIC_BASE_SYSTEM_COLUMNS: MagicBaseColumn[] = [
	{
		id: "system:id",
		table_id: "",
		column_key: "id",
		column_name: "id",
		data_type: "id",
		is_required: true,
		status: "enabled",
		source: "system",
		readonly: true,
		system: true,
	},
	{
		id: "system:organization_code",
		table_id: "",
		column_key: "organization_code",
		column_name: "organization_code",
		data_type: "text",
		is_required: true,
		status: "enabled",
		source: "system",
		readonly: true,
		system: true,
	},
	{
		id: "system:created_by",
		table_id: "",
		column_key: "created_by",
		column_name: "created_by",
		data_type: "text",
		is_required: true,
		status: "enabled",
		source: "system",
		readonly: true,
		system: true,
	},
	{
		id: "system:created_at",
		table_id: "",
		column_key: "created_at",
		column_name: "created_at",
		data_type: "datetime",
		is_required: true,
		status: "enabled",
		source: "system",
		readonly: true,
		system: true,
	},
	{
		id: "system:updated_at",
		table_id: "",
		column_key: "updated_at",
		column_name: "updated_at",
		data_type: "datetime",
		is_required: true,
		status: "enabled",
		source: "system",
		readonly: true,
		system: true,
	},
]
const MAGIC_BASE_ID_COLUMN = MAGIC_BASE_SYSTEM_COLUMNS[0]
const MAGIC_BASE_TRAILING_SYSTEM_COLUMNS = MAGIC_BASE_SYSTEM_COLUMNS.slice(1)
const MAGIC_BASE_SYSTEM_COLUMN_KEYS = new Set(
	MAGIC_BASE_SYSTEM_COLUMNS.map((column) => column.column_key),
)

export interface MagicBaseGridColumn {
	id?: string
	key: string
	name: string
	type?: string
	source?: "system" | "schema" | "row"
}

/** 表说明作为用户可读名称，表名作为次级标识展示。 */
export function getMagicBaseTableDisplayName(table?: MagicBaseTable | null): string {
	return table?.description || table?.table_name || table?.table_key || ""
}

export function getMagicBaseTableName(table?: MagicBaseTable | null): string {
	return table?.table_name || table?.table_key || ""
}

export function createEmptyMagicBaseFilter(): MagicBaseFilterGroup {
	return { logic: "and", items: [] }
}

export function isMagicBaseFilterCondition(
	item: MagicBaseFilterCondition | MagicBaseFilterGroup,
): item is MagicBaseFilterCondition {
	return "field" in item
}

export function getMagicBaseFilterConditionCount(filter: MagicBaseFilterGroup): number {
	return filter.items.reduce(
		(total, item) =>
			total + (isMagicBaseFilterCondition(item) ? 1 : getMagicBaseFilterConditionCount(item)),
		0,
	)
}

export function normalizeMagicBaseBooleanValue(value: unknown): boolean {
	if (typeof value === "string") {
		return ["1", "true"].includes(value.trim().toLowerCase())
	}
	return value === true || value === 1
}

function appendUnique(fields: string[], field?: string) {
	if (!field || fields.includes(field)) return
	fields.push(field)
}

export function getEnabledColumns(table?: MagicBaseTable | null): MagicBaseColumn[] {
	return (table?.columns || []).filter((column) => column.status !== "disabled")
}

function normalizeSystemColumn(column: MagicBaseColumn, table?: MagicBaseTable | null) {
	return {
		...column,
		table_id: table?.id || "",
		source: "system" as const,
	}
}

function getDisplaySchemaColumns(table?: MagicBaseTable | null): MagicBaseColumn[] {
	return getEnabledColumns(table)
		.filter((column) => !MAGIC_BASE_SYSTEM_COLUMN_KEYS.has(column.column_key))
		.map((column) => ({
			...column,
			source: column.source || "schema",
		}))
}

export function getDisplayColumns(table?: MagicBaseTable | null): MagicBaseColumn[] {
	const columns: MagicBaseColumn[] = []
	const keys = new Set<string>()
	;[
		normalizeSystemColumn(MAGIC_BASE_ID_COLUMN, table),
		...getDisplaySchemaColumns(table),
		...MAGIC_BASE_TRAILING_SYSTEM_COLUMNS.map((column) => normalizeSystemColumn(column, table)),
	].forEach((column) => {
		if (keys.has(column.column_key)) return
		keys.add(column.column_key)
		columns.push(column)
	})
	return columns
}

export function buildMagicBaseSelect(table?: MagicBaseTable | null): string {
	const fields: string[] = []
	getDisplayColumns(table).forEach((column) => appendUnique(fields, column.column_key))
	return fields.join(",")
}

export function getDefaultSort(): MagicBaseSortRule | null {
	return { field: "created_at", order: "desc" }
}

export function buildMagicBaseRowsRequest(params: {
	table?: MagicBaseTable | null
	sort: MagicBaseSortRule | null
	page: number
	filter?: MagicBaseFilterGroup
	includeTotal?: boolean
}): MagicBaseQueryRowsRequest {
	const filter = params.filter || createEmptyMagicBaseFilter()
	return {
		select: buildMagicBaseSelect(params.table),
		filter,
		sort: params.sort ? [params.sort] : [],
		page: params.page,
		page_size: MAGIC_BASE_PAGE_SIZE,
		include_total:
			params.includeTotal ??
			(params.page === 1 && getMagicBaseFilterConditionCount(filter) === 0),
	}
}

export function buildGridColumns(
	table?: MagicBaseTable | null,
	rows: MagicBaseRow[] = [],
	showSystemFields = false,
) {
	const columns: MagicBaseGridColumn[] = [
		...(showSystemFields
			? [
					{
						key: MAGIC_BASE_ID_COLUMN.column_key,
						name: MAGIC_BASE_ID_COLUMN.column_name || MAGIC_BASE_ID_COLUMN.column_key,
						type: MAGIC_BASE_ID_COLUMN.data_type,
						source: "system" as const,
					},
				]
			: []),
		...getDisplaySchemaColumns(table).map((column) => ({
			id: column.id,
			key: column.column_key,
			name: column.column_name || column.column_key,
			type: column.data_type,
			source: column.source || "schema",
		})),
	]
	const knownKeys = new Set(columns.map((column) => column.key))
	MAGIC_BASE_SYSTEM_COLUMN_KEYS.forEach((key) => knownKeys.add(key))

	rows.forEach((row) => {
		Object.keys(row).forEach((key) => {
			if (knownKeys.has(key)) return
			knownKeys.add(key)
			columns.push({ key, name: key, source: "row" })
		})
	})

	if (showSystemFields) {
		MAGIC_BASE_TRAILING_SYSTEM_COLUMNS.forEach((column) => {
			if (columns.some((item) => item.key === column.column_key)) return
			columns.push({
				key: column.column_key,
				name: column.column_name || column.column_key,
				type: column.data_type,
				source: "system",
			})
		})
	}

	return columns
}

export function formatCellValue(value: unknown): string {
	if (value == null) return "NULL"
	if (typeof value === "string") return value
	if (typeof value === "number" || typeof value === "boolean") return String(value)
	try {
		return JSON.stringify(value)
	} catch {
		return String(value)
	}
}
