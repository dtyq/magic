/**
 * Iframe MagicBase 专用接口层。
 *
 * 这些请求通过 iframeClient 发起，避免 iframe 场景的错误触发主站全局跳转。
 */

import { defaultIframeClient as iframeClient } from "@/infrastructure/network/http/runtime"
import {
	getShareAccessToken,
	type FileAccessContext,
} from "@/pages/superMagic/fileAccess/fileAccessContext"

function withMagicBaseShareToken(access?: FileAccessContext | null) {
	const token = getShareAccessToken(access)
	if (!token) return undefined
	return {
		headers: {
			token,
		},
	}
}

/**
 * 检查当前真实登录用户是否拥有当前项目的管理员权限。
 * 分享 token 由 host 自动携带，但不会被当作管理员身份。
 */
export async function getMagicBaseProjectAdminAccess(
	projectId: string,
	access?: FileAccessContext | null,
): Promise<{
	project_id: string
	is_admin: boolean
}> {
	return iframeClient.get(
		`/api/v1/magicbase/projects/${projectId}/admin-access`,
		withMagicBaseShareToken(access),
	)
}

/**
 * 获取项目下所有表。
 */
export async function getMagicBaseTables(
	projectId: string,
	access?: FileAccessContext | null,
): Promise<unknown[]> {
	return iframeClient.get(
		`/api/v1/magicbase/projects/${projectId}/tables`,
		withMagicBaseShareToken(access),
	)
}

/**
 * 获取单张表详情（含字段定义）。
 */
export async function getMagicBaseTable(
	projectId: string,
	tableId: string,
	access?: FileAccessContext | null,
): Promise<unknown> {
	return iframeClient.get(
		`/api/v1/magicbase/projects/${projectId}/tables/${tableId}`,
		withMagicBaseShareToken(access),
	)
}

/**
 * 新增一行数据。
 */
export async function createMagicBaseRow(
	projectId: string,
	tableId: string,
	data: Record<string, unknown>,
	select?: string[],
	access?: FileAccessContext | null,
): Promise<unknown> {
	return iframeClient.post(
		`/api/v1/magicbase/projects/${projectId}/tables/${tableId}/rows`,
		{
			data,
			...(select ? { select: select.join(",") } : {}),
		},
		withMagicBaseShareToken(access),
	)
}

/**
 * 分页查询行。
 */
export async function queryMagicBaseRows(
	projectId: string,
	tableId: string,
	query: Record<string, unknown>,
	access?: FileAccessContext | null,
): Promise<unknown> {
	const requestBody = {
		...query,
		...(Array.isArray(query.select) ? { select: query.select.join(",") } : {}),
	}

	return iframeClient.post(
		`/api/v1/magicbase/projects/${projectId}/tables/${tableId}/query`,
		requestBody,
		withMagicBaseShareToken(access),
	)
}

/**
 * 获取单行详情。
 */
export async function getMagicBaseRow(
	projectId: string,
	tableId: string,
	recordId: string,
	select?: string[],
	access?: FileAccessContext | null,
): Promise<unknown> {
	const result = await iframeClient.post<{ list?: unknown[] }>(
		`/api/v1/magicbase/projects/${projectId}/tables/${tableId}/query`,
		{
			filter: { id: { eq: recordId } },
			page: 1,
			page_size: 1,
			...(select?.length ? { select: select.join(",") } : {}),
		},
		withMagicBaseShareToken(access),
	)

	const row = result.list?.[0]
	if (row === undefined) {
		throw new Error("MagicBase row not found")
	}

	return row
}

/**
 * 更新一行数据。
 */
export async function updateMagicBaseRow(
	projectId: string,
	tableId: string,
	recordId: string,
	data: Record<string, unknown>,
	select?: string[],
	access?: FileAccessContext | null,
): Promise<unknown> {
	return iframeClient.patch(
		`/api/v1/magicbase/projects/${projectId}/tables/${tableId}/rows/${recordId}`,
		{
			data,
			...(select ? { select: select.join(",") } : {}),
		},
		withMagicBaseShareToken(access),
	)
}

/**
 * 删除一行数据。
 */
export async function deleteMagicBaseRow(
	projectId: string,
	tableId: string,
	recordId: string,
	access?: FileAccessContext | null,
): Promise<void> {
	return iframeClient.delete(
		`/api/v1/magicbase/projects/${projectId}/tables/${tableId}/rows/${recordId}`,
		undefined,
		withMagicBaseShareToken(access),
	)
}

/**
 * 获取项目关系列表。
 */
export async function getMagicBaseRelations(
	projectId: string,
	access?: FileAccessContext | null,
): Promise<unknown[]> {
	return iframeClient.get(
		`/api/v1/magicbase/projects/${projectId}/relations`,
		withMagicBaseShareToken(access),
	)
}
