/**
 * ossSrc 过期时间相关工具
 * 格式: 2026-03-03 11:14:03（按本地时间解析）
 */

/** 提前刷新缓冲时间（毫秒），在过期前 5 分钟视为已过期 */
export const OSS_EXPIRY_BUFFER_MS = 5 * 60 * 1000

/**
 * 解析 expires_at 字符串为时间戳
 * @param expiresAt 格式: 2026-03-03 11:14:03
 * @returns 时间戳（毫秒），解析失败返回 null
 */
export function parseExpiresAt(expiresAt: string | undefined): number | null {
	if (!expiresAt || typeof expiresAt !== "string") return null
	// 将 "2026-03-03 11:14:03" 转为 "2026-03-03T11:14:03" 以便 Date 解析（按本地时间）
	const isoLike = expiresAt.trim().replace(/\s+/, "T")
	const ts = Date.parse(isoLike)
	return Number.isNaN(ts) ? null : ts
}

/**
 * 判断 ossSrc 是否已过期（含提前刷新缓冲）
 * @param expiresAtTs 过期时间戳，null 表示永不过期
 */
export function isOssExpired(expiresAtTs: number | null): boolean {
	if (expiresAtTs === null) return false
	return Date.now() >= expiresAtTs - OSS_EXPIRY_BUFFER_MS
}
