/**
 * IframeDatabaseService
 *
 * 处理 MAGIC_DB_* 消息，为主站（parent window）提供
 * MagicBase 数据库的 CRUD 代理能力。
 * 纯 class，不依赖 React，由 useIframeDatabase hook 持有实例。
 *
 * 安全要点：projectId 由主站上下文提供，iframe 无法指定，
 * 确保 HTML 微应用只能操作当前项目的数据库。
 */

import {
	DB_MESSAGE_TYPES,
	type DBGetTablesRequest,
	type DBGetProjectAdminAccessRequest,
	type DBGetTableRequest,
	type DBCreateRowRequest,
	type DBQueryRowsRequest,
	type DBGetRowRequest,
	type DBUpdateRowRequest,
	type DBDeleteRowRequest,
	type DBGetRelationsRequest,
} from "../types"
import {
	getMagicBaseTables,
	getMagicBaseProjectAdminAccess,
	getMagicBaseTable,
	createMagicBaseRow,
	queryMagicBaseRows,
	getMagicBaseRow,
	updateMagicBaseRow,
	deleteMagicBaseRow,
	getMagicBaseRelations,
} from "../magicBaseApi"
import type { FileAccessContext } from "@/pages/superMagic/fileAccess/fileAccessContext"

export interface IframeDatabaseConfig {
	/** 向 iframe 发送消息的函数 */
	postToIframe: (message: object) => void
	/** 获取当前项目 ID 的函数（由主站上下文注入） */
	getProjectId: () => string | undefined
	/** 项目上下文不可用时返回给 iframe 的语义化错误。 */
	projectContextUnavailableError?: string
	getFileAccess?: () => FileAccessContext | null
}

export class IframeDatabaseService {
	private readonly cfg: IframeDatabaseConfig

	constructor(cfg: IframeDatabaseConfig) {
		this.cfg = cfg
	}

	/**
	 * 主路由入口，由 useIframeDatabase → IsolatedHTMLRenderer 的 handleMessage 调用。
	 * 返回 true 表示消息已被处理。
	 */
	async handleMessage(type: string, payload: unknown): Promise<boolean> {
		switch (type) {
			case DB_MESSAGE_TYPES.GET_TABLES_REQUEST:
				await this.handleGetTables(payload as DBGetTablesRequest)
				return true
			case DB_MESSAGE_TYPES.GET_PROJECT_ADMIN_ACCESS_REQUEST:
				await this.handleGetProjectAdminAccess(payload as DBGetProjectAdminAccessRequest)
				return true
			case DB_MESSAGE_TYPES.GET_TABLE_REQUEST:
				await this.handleGetTable(payload as DBGetTableRequest)
				return true
			case DB_MESSAGE_TYPES.CREATE_ROW_REQUEST:
				await this.handleCreateRow(payload as DBCreateRowRequest)
				return true
			case DB_MESSAGE_TYPES.QUERY_ROWS_REQUEST:
				await this.handleQueryRows(payload as DBQueryRowsRequest)
				return true
			case DB_MESSAGE_TYPES.GET_ROW_REQUEST:
				await this.handleGetRow(payload as DBGetRowRequest)
				return true
			case DB_MESSAGE_TYPES.UPDATE_ROW_REQUEST:
				await this.handleUpdateRow(payload as DBUpdateRowRequest)
				return true
			case DB_MESSAGE_TYPES.DELETE_ROW_REQUEST:
				await this.handleDeleteRow(payload as DBDeleteRowRequest)
				return true
			case DB_MESSAGE_TYPES.GET_RELATIONS_REQUEST:
				await this.handleGetRelations(payload as DBGetRelationsRequest)
				return true
			default:
				return false
		}
	}

	destroy() {
		// No persistent resources to clean up
	}

	// ─── 内部处理 ────────────────────────────────────────────────────────────────

	private getProjectIdOrThrow(): string {
		const projectId = this.cfg.getProjectId()
		if (!projectId) {
			throw new Error(this.cfg.projectContextUnavailableError || "No project selected")
		}
		return projectId
	}

	private getFileAccess() {
		return this.cfg.getFileAccess?.() ?? null
	}

	private async handleGetTables(req: DBGetTablesRequest) {
		const { requestId } = req
		try {
			const projectId = this.getProjectIdOrThrow()
			const tables = await getMagicBaseTables(projectId, this.getFileAccess())
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.GET_TABLES_RESPONSE,
				requestId,
				success: true,
				content: tables,
			})
		} catch (error) {
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.GET_TABLES_RESPONSE,
				requestId,
				success: false,
				error: error instanceof Error ? error.message : "Failed to get tables",
			})
		}
	}

	private async handleGetProjectAdminAccess(req: DBGetProjectAdminAccessRequest) {
		const { requestId } = req
		try {
			const projectId = this.getProjectIdOrThrow()
			const access = await getMagicBaseProjectAdminAccess(projectId, this.getFileAccess())
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.GET_PROJECT_ADMIN_ACCESS_RESPONSE,
				requestId,
				success: true,
				content: access,
			})
		} catch (error) {
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.GET_PROJECT_ADMIN_ACCESS_RESPONSE,
				requestId,
				success: false,
				error:
					error instanceof Error ? error.message : "Failed to check project admin access",
			})
		}
	}

	private async handleGetTable(req: DBGetTableRequest) {
		const { requestId, tableId } = req
		try {
			const projectId = this.getProjectIdOrThrow()
			const table = await getMagicBaseTable(projectId, tableId, this.getFileAccess())
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.GET_TABLE_RESPONSE,
				requestId,
				success: true,
				content: table,
			})
		} catch (error) {
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.GET_TABLE_RESPONSE,
				requestId,
				success: false,
				error: error instanceof Error ? error.message : "Failed to get table",
			})
		}
	}

	private async handleCreateRow(req: DBCreateRowRequest) {
		const { requestId, tableId, data, select } = req
		try {
			const projectId = this.getProjectIdOrThrow()
			const row = await createMagicBaseRow(
				projectId,
				tableId,
				data,
				select,
				this.getFileAccess(),
			)
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.CREATE_ROW_RESPONSE,
				requestId,
				success: true,
				content: row,
			})
		} catch (error) {
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.CREATE_ROW_RESPONSE,
				requestId,
				success: false,
				error: error instanceof Error ? error.message : "Failed to create row",
			})
		}
	}

	private async handleQueryRows(req: DBQueryRowsRequest) {
		const { requestId, tableId, query } = req
		try {
			const projectId = this.getProjectIdOrThrow()
			const result = await queryMagicBaseRows(projectId, tableId, query, this.getFileAccess())
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.QUERY_ROWS_RESPONSE,
				requestId,
				success: true,
				content: result,
			})
		} catch (error) {
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.QUERY_ROWS_RESPONSE,
				requestId,
				success: false,
				error: error instanceof Error ? error.message : "Failed to query rows",
			})
		}
	}

	private async handleGetRow(req: DBGetRowRequest) {
		const { requestId, tableId, recordId, select } = req
		try {
			const projectId = this.getProjectIdOrThrow()
			const row = await getMagicBaseRow(
				projectId,
				tableId,
				recordId,
				select,
				this.getFileAccess(),
			)
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.GET_ROW_RESPONSE,
				requestId,
				success: true,
				content: row,
			})
		} catch (error) {
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.GET_ROW_RESPONSE,
				requestId,
				success: false,
				error: error instanceof Error ? error.message : "Failed to get row",
			})
		}
	}

	private async handleUpdateRow(req: DBUpdateRowRequest) {
		const { requestId, tableId, recordId, data, select } = req
		try {
			const projectId = this.getProjectIdOrThrow()
			const row = await updateMagicBaseRow(
				projectId,
				tableId,
				recordId,
				data,
				select,
				this.getFileAccess(),
			)
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.UPDATE_ROW_RESPONSE,
				requestId,
				success: true,
				content: row,
			})
		} catch (error) {
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.UPDATE_ROW_RESPONSE,
				requestId,
				success: false,
				error: error instanceof Error ? error.message : "Failed to update row",
			})
		}
	}

	private async handleDeleteRow(req: DBDeleteRowRequest) {
		const { requestId, tableId, recordId } = req
		try {
			const projectId = this.getProjectIdOrThrow()
			await deleteMagicBaseRow(projectId, tableId, recordId, this.getFileAccess())
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.DELETE_ROW_RESPONSE,
				requestId,
				success: true,
			})
		} catch (error) {
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.DELETE_ROW_RESPONSE,
				requestId,
				success: false,
				error: error instanceof Error ? error.message : "Failed to delete row",
			})
		}
	}

	private async handleGetRelations(req: DBGetRelationsRequest) {
		const { requestId } = req
		try {
			const projectId = this.getProjectIdOrThrow()
			const relations = await getMagicBaseRelations(projectId, this.getFileAccess())
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.GET_RELATIONS_RESPONSE,
				requestId,
				success: true,
				content: relations,
			})
		} catch (error) {
			this.cfg.postToIframe({
				type: DB_MESSAGE_TYPES.GET_RELATIONS_RESPONSE,
				requestId,
				success: false,
				error: error instanceof Error ? error.message : "Failed to get relations",
			})
		}
	}
}
