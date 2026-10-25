import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"

export interface MagicBasePermissionScope {
	read_scope?: string
	insert_scope?: string
	edit_scope?: string
	delete_scope?: string
}

export interface MagicBaseDynamicPermissions {
	table?: MagicBasePermissionScope
	row?: MagicBasePermissionScope
	columns?: Record<string, MagicBasePermissionScope>
}

export interface MagicBaseColumn {
	id: string
	table_id: string
	column_key: string
	column_name: string
	data_type: string
	is_required: boolean
	status: string
	source?: "system" | "schema"
	readonly?: boolean
	system?: boolean
	dynamic_permission?: MagicBasePermissionScope
	created_at?: string
	updated_at?: string
}

export interface MagicBaseTable {
	id: string
	project_id: string
	table_key: string
	table_name: string
	description?: string
	status: string
	dynamic_permissions?: MagicBaseDynamicPermissions
	created_by?: string
	created_at?: string
	updated_at?: string
	columns: MagicBaseColumn[]
}

export interface MagicBaseSortRule {
	field: string
	order: "asc" | "desc"
}

export type MagicBaseFilterLogic = "and" | "or"

export type MagicBaseFilterOperator = "eq" | "in" | "contains" | "gt" | "gte" | "lt" | "lte"

export type MagicBaseFilterScalar = boolean | number | string

export interface MagicBaseFilterCondition {
	field: string
	operator: MagicBaseFilterOperator
	value: MagicBaseFilterScalar | MagicBaseFilterScalar[]
}

export interface MagicBaseFilterGroup {
	logic: MagicBaseFilterLogic
	items: Array<MagicBaseFilterCondition | MagicBaseFilterGroup>
}

export interface MagicBaseQueryRowsRequest {
	select: string
	filter: MagicBaseFilterGroup | Record<string, unknown>
	sort: MagicBaseSortRule[]
	page: number
	page_size: number
	include_total?: boolean
}

export type MagicBaseRow = Record<string, unknown>

export interface MagicBaseQueryRowsResponse {
	page: number
	page_size: number
	total: number
	has_more?: boolean
	list: MagicBaseRow[]
}

export interface MagicBaseRowWriteRequest {
	data: Record<string, unknown>
	select?: string
}

export interface MagicBaseUpdateDynamicPermissionsRequest {
	dynamic_permissions: MagicBaseDynamicPermissions
}

export interface MagicBaseBatchDeleteRowsRequest {
	record_ids: string[]
}

export interface MagicBaseBatchDeleteRowsResponse {
	deleted_count: number
	record_ids: string[]
}

export type MagicBasePermissionSubjectType = "user" | "department" | "organization" | "anonymous"

export type MagicBaseTablePermissionLevel = "read" | "insert" | "manage"

export type MagicBasePermissionTargetType = "table" | "column" | "row"

export type MagicBaseAssignablePermissionSubjectType = Extract<
	MagicBasePermissionSubjectType,
	"user" | "department"
>

export interface MagicBaseTablePermission {
	id: string
	table_id: string
	subject_type: MagicBasePermissionSubjectType
	subject_id: string
	permission_level: MagicBaseTablePermissionLevel
}

export interface MagicBaseColumnPermission {
	id: string
	table_id: string
	column_id: string
	subject_type: MagicBasePermissionSubjectType
	subject_id: string
	can_read: boolean
	can_edit: boolean
}

export interface MagicBaseRowPermission {
	id: string
	table_id: string
	record_id: string
	subject_type: MagicBasePermissionSubjectType
	subject_id: string
	can_read: boolean
	can_edit: boolean
	can_delete: boolean
}

export interface MagicBasePermissionsResponse {
	table_permissions: MagicBaseTablePermission[]
	column_permissions: MagicBaseColumnPermission[]
	row_permissions: MagicBaseRowPermission[]
}

export interface MagicBaseBatchPermissionRequest {
	target_type: MagicBasePermissionTargetType
	target_ids?: string[]
	permissions: Array<{
		subject_type: MagicBaseAssignablePermissionSubjectType
		subject_id: string
		target_type: MagicBasePermissionTargetType
		table_permissions: MagicBaseTablePermissionLevel[]
		column_permissions: Array<{
			column_ids: string[]
			can_read: boolean
			can_edit: boolean
		}>
		row_permissions: Array<{
			record_ids: string[]
			can_read: boolean
			can_edit: boolean
			can_delete: boolean
		}>
	}>
}

type RawMagicBaseColumn = Omit<MagicBaseColumn, "id" | "table_id"> & {
	id?: string | number
	table_id?: string | number
}

type RawMagicBaseTable = Omit<MagicBaseTable, "id" | "project_id" | "columns"> & {
	id?: string | number
	project_id?: string | number
	columns?: RawMagicBaseColumn[]
}

type RawTablePermission = Omit<MagicBaseTablePermission, "id" | "table_id" | "subject_id"> & {
	id?: string | number
	table_id?: string | number
	subject_id?: string | number
}

type RawColumnPermission = Omit<
	MagicBaseColumnPermission,
	"id" | "table_id" | "column_id" | "subject_id"
> & {
	id?: string | number
	table_id?: string | number
	column_id?: string | number
	subject_id?: string | number
}

type RawRowPermission = Omit<
	MagicBaseRowPermission,
	"id" | "table_id" | "record_id" | "subject_id"
> & {
	id?: string | number
	table_id?: string | number
	record_id?: string | number
	subject_id?: string | number
}

type RawPermissionsResponse = {
	table_permissions?: RawTablePermission[]
	column_permissions?: RawColumnPermission[]
	row_permissions?: RawRowPermission[]
}

function toId(value: string | number | null | undefined): string {
	return value == null ? "" : String(value)
}

export function normalizeMagicBaseColumn(column: RawMagicBaseColumn): MagicBaseColumn {
	return {
		id: toId(column.id),
		table_id: toId(column.table_id),
		column_key: column.column_key || "",
		column_name: column.column_name || column.column_key || "",
		data_type: column.data_type || "",
		is_required: Boolean(column.is_required),
		status: column.status || "",
		source: column.source || "schema",
		readonly: Boolean(column.readonly),
		system: Boolean(column.system),
		dynamic_permission: column.dynamic_permission,
		created_at: column.created_at,
		updated_at: column.updated_at,
	}
}

export function normalizeMagicBaseTable(table: RawMagicBaseTable): MagicBaseTable {
	return {
		id: toId(table.id),
		project_id: toId(table.project_id),
		table_key: table.table_key || "",
		table_name: table.table_name || table.table_key || "",
		description: table.description,
		status: table.status || "",
		dynamic_permissions: table.dynamic_permissions,
		created_by: table.created_by,
		created_at: table.created_at,
		updated_at: table.updated_at,
		columns: (table.columns || []).map(normalizeMagicBaseColumn),
	}
}

function normalizeTablePermission(permission: RawTablePermission): MagicBaseTablePermission {
	return {
		id: toId(permission.id),
		table_id: toId(permission.table_id),
		subject_type: permission.subject_type,
		subject_id: toId(permission.subject_id),
		permission_level: permission.permission_level,
	}
}

function normalizeColumnPermission(permission: RawColumnPermission): MagicBaseColumnPermission {
	return {
		id: toId(permission.id),
		table_id: toId(permission.table_id),
		column_id: toId(permission.column_id),
		subject_type: permission.subject_type,
		subject_id: toId(permission.subject_id),
		can_read: Boolean(permission.can_read),
		can_edit: Boolean(permission.can_edit),
	}
}

function normalizeRowPermission(permission: RawRowPermission): MagicBaseRowPermission {
	return {
		id: toId(permission.id),
		table_id: toId(permission.table_id),
		record_id: toId(permission.record_id),
		subject_type: permission.subject_type,
		subject_id: toId(permission.subject_id),
		can_read: Boolean(permission.can_read),
		can_edit: Boolean(permission.can_edit),
		can_delete: Boolean(permission.can_delete),
	}
}

function normalizePermissions(payload: RawPermissionsResponse): MagicBasePermissionsResponse {
	return {
		table_permissions: (payload.table_permissions || []).map(normalizeTablePermission),
		column_permissions: (payload.column_permissions || []).map(normalizeColumnPermission),
		row_permissions: (payload.row_permissions || []).map(normalizeRowPermission),
	}
}

export function generateMagicBaseApi(fetch: ServiceHttpClient) {
	const largeIntConfig = { parseJsonLargeIntAsString: true }

	return {
		async getTables(projectId: string): Promise<MagicBaseTable[]> {
			const data = await fetch.get<RawMagicBaseTable[]>(
				`/api/v1/magicbase/projects/${projectId}/tables`,
				largeIntConfig,
			)
			return data.map(normalizeMagicBaseTable)
		},

		async getTable(projectId: string, tableId: string): Promise<MagicBaseTable> {
			const data = await fetch.get<RawMagicBaseTable>(
				`/api/v1/magicbase/projects/${projectId}/tables/${tableId}`,
				largeIntConfig,
			)
			return normalizeMagicBaseTable(data)
		},

		async updateDynamicPermissions(
			projectId: string,
			tableId: string,
			body: MagicBaseUpdateDynamicPermissionsRequest,
		): Promise<MagicBaseTable> {
			const data = await fetch.patch<RawMagicBaseTable>(
				`/api/v1/magicbase/projects/${projectId}/tables/${tableId}`,
				body,
				largeIntConfig,
			)
			return normalizeMagicBaseTable(data)
		},

		queryRows(
			projectId: string,
			tableId: string,
			body: MagicBaseQueryRowsRequest,
		): Promise<MagicBaseQueryRowsResponse> {
			return fetch.post<MagicBaseQueryRowsResponse>(
				`/api/v1/magicbase/projects/${projectId}/tables/${tableId}/query`,
				body,
				largeIntConfig,
			)
		},

		createRow(
			projectId: string,
			tableId: string,
			body: MagicBaseRowWriteRequest,
		): Promise<MagicBaseRow> {
			return fetch.post<MagicBaseRow>(
				`/api/v1/magicbase/projects/${projectId}/tables/${tableId}/rows`,
				body,
				largeIntConfig,
			)
		},

		updateRow(
			projectId: string,
			tableId: string,
			recordId: string,
			body: MagicBaseRowWriteRequest,
		): Promise<MagicBaseRow> {
			return fetch.patch<MagicBaseRow>(
				`/api/v1/magicbase/projects/${projectId}/tables/${tableId}/rows/${recordId}`,
				body,
				largeIntConfig,
			)
		},

		batchDeleteRows(
			projectId: string,
			tableId: string,
			body: MagicBaseBatchDeleteRowsRequest,
		): Promise<MagicBaseBatchDeleteRowsResponse> {
			return fetch.post<MagicBaseBatchDeleteRowsResponse>(
				`/api/v1/magicbase/projects/${projectId}/tables/${tableId}/rows/batch-delete`,
				body,
				largeIntConfig,
			)
		},

		async getPermissions(
			projectId: string,
			tableId: string,
		): Promise<MagicBasePermissionsResponse> {
			const data = await fetch.get<RawPermissionsResponse>(
				`/api/v1/magicbase/projects/${projectId}/tables/${tableId}/permissions`,
				largeIntConfig,
			)
			return normalizePermissions(data)
		},

		async batchSavePermissions(
			projectId: string,
			tableId: string,
			body: MagicBaseBatchPermissionRequest,
		): Promise<MagicBasePermissionsResponse> {
			const data = await fetch.post<RawPermissionsResponse>(
				`/api/v1/magicbase/projects/${projectId}/tables/${tableId}/permissions/batch`,
				body,
				largeIntConfig,
			)
			return normalizePermissions(data)
		},
	}
}
