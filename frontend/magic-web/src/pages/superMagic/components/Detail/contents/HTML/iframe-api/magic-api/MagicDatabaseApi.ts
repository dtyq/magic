/**
 * MagicDatabaseApi
 *
 * 向 iframe 内的 window.Magic.db 注入数据库 CRUD API。
 * 所有操作通过 postMessage 委托给主站（parent window）的
 * IframeDatabaseService 处理，再由 Service 调用后端 MagicBase REST API。
 *
 * 仅暴露数据操作接口，不暴露表结构变更、权限管理等管理接口。
 */

import { BaseRuntimeBridgeApiPlugin } from "@dtyq/html-sandbox"

export class MagicDatabaseApi extends BaseRuntimeBridgeApiPlugin {
	constructor() {
		super("MagicDatabaseApi")
	}

	install(): void {
		if (!window.Magic) window.Magic = {}
		if (window.Magic.db) return

		window.Magic.db = {
			/**
			 * 获取当前项目下所有表摘要。
			 * @returns Promise<Array<{ id: string; name: string; ... }>>
			 */
			getTables: (): Promise<unknown[]> => {
				return this.request<unknown[]>("MAGIC_DB_GET_TABLES_REQUEST", {}, 15000, (data) =>
					Array.isArray(data["content"]) ? data["content"] : [],
				)
			},

			/**
			 * 获取当前真实登录用户的项目管理员权限。
			 * 分享 token 只用于校验分享访问，不会把分享创建者当成当前用户。
			 */
			getProjectAdminAccess: (): Promise<{ project_id: string; is_admin: boolean }> => {
				return this.request<{ project_id: string; is_admin: boolean }>(
					"MAGIC_DB_GET_PROJECT_ADMIN_ACCESS_REQUEST",
					{},
					15000,
					(data) => {
						const content = data["content"]
						if (!content || typeof content !== "object") {
							throw new Error("Invalid project admin access response")
						}
						const value = content as { project_id?: unknown; is_admin?: unknown }
						return {
							project_id: String(value.project_id ?? ""),
							is_admin: value.is_admin === true,
						}
					},
				)
			},

			/**
			 * 获取单张表详情（含字段定义）。
			 * @param tableId 表 ID
			 */
			getTable: (tableId: string): Promise<unknown> => {
				if (typeof tableId !== "string" || !tableId) {
					return Promise.reject(new Error("getTable: tableId must be a non-empty string"))
				}
				return this.request<unknown>("MAGIC_DB_GET_TABLE_REQUEST", { tableId })
			},

			/**
			 * 新增一行数据。
			 * @param tableId 表 ID
			 * @param data    行数据（字段名 → 值）
			 * @param select  可选，指定返回的字段列表
			 */
			createRow: (
				tableId: string,
				data: Record<string, unknown>,
				select?: string[],
			): Promise<unknown> => {
				if (typeof tableId !== "string" || !tableId) {
					return Promise.reject(
						new Error("createRow: tableId must be a non-empty string"),
					)
				}
				if (!data || typeof data !== "object") {
					return Promise.reject(new Error("createRow: data must be an object"))
				}
				return this.request<unknown>("MAGIC_DB_CREATE_ROW_REQUEST", {
					tableId,
					data,
					select,
				})
			},

			/**
			 * 分页查询行（支持 filter/sort/select/关联查询）。
			 * @param tableId 表 ID
			 * @param query   查询参数
			 */
			queryRows: (
				tableId: string,
				query: {
					filter?: unknown
					sort?: unknown
					select?: string[]
					page?: number
					page_size?: number
					with?: unknown
				},
			): Promise<unknown> => {
				if (typeof tableId !== "string" || !tableId) {
					return Promise.reject(
						new Error("queryRows: tableId must be a non-empty string"),
					)
				}
				return this.request<unknown>(
					"MAGIC_DB_QUERY_ROWS_REQUEST",
					{ tableId, query: query ?? {} },
					30000,
				)
			},

			/**
			 * 获取单行详情。
			 * @param tableId  表 ID
			 * @param recordId 行 ID
			 * @param select   可选，指定返回的字段列表
			 */
			getRow: (tableId: string, recordId: string, select?: string[]): Promise<unknown> => {
				if (typeof tableId !== "string" || !tableId) {
					return Promise.reject(new Error("getRow: tableId must be a non-empty string"))
				}
				if (typeof recordId !== "string" || !recordId) {
					return Promise.reject(new Error("getRow: recordId must be a non-empty string"))
				}
				return this.request<unknown>("MAGIC_DB_GET_ROW_REQUEST", {
					tableId,
					recordId,
					select,
				})
			},

			/**
			 * 更新一行数据。
			 * @param tableId  表 ID
			 * @param recordId 行 ID
			 * @param data     要更新的字段
			 * @param select   可选，指定返回的字段列表
			 */
			updateRow: (
				tableId: string,
				recordId: string,
				data: Record<string, unknown>,
				select?: string[],
			): Promise<unknown> => {
				if (typeof tableId !== "string" || !tableId) {
					return Promise.reject(
						new Error("updateRow: tableId must be a non-empty string"),
					)
				}
				if (typeof recordId !== "string" || !recordId) {
					return Promise.reject(
						new Error("updateRow: recordId must be a non-empty string"),
					)
				}
				if (!data || typeof data !== "object") {
					return Promise.reject(new Error("updateRow: data must be an object"))
				}
				return this.request<unknown>("MAGIC_DB_UPDATE_ROW_REQUEST", {
					tableId,
					recordId,
					data,
					select,
				})
			},

			/**
			 * 删除一行数据。
			 * @param tableId  表 ID
			 * @param recordId 行 ID
			 */
			deleteRow: (tableId: string, recordId: string): Promise<void> => {
				if (typeof tableId !== "string" || !tableId) {
					return Promise.reject(
						new Error("deleteRow: tableId must be a non-empty string"),
					)
				}
				if (typeof recordId !== "string" || !recordId) {
					return Promise.reject(
						new Error("deleteRow: recordId must be a non-empty string"),
					)
				}
				return this.request<void>(
					"MAGIC_DB_DELETE_ROW_REQUEST",
					{ tableId, recordId },
					15000,
					() => undefined,
				)
			},

			/**
			 * 获取当前项目的关系列表。
			 */
			getRelations: (): Promise<unknown[]> => {
				return this.request<unknown[]>(
					"MAGIC_DB_GET_RELATIONS_REQUEST",
					{},
					15000,
					(data) => (Array.isArray(data["content"]) ? data["content"] : []),
				)
			},
		}
	}
}
