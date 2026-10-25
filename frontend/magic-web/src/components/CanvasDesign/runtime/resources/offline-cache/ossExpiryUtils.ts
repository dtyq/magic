/**
 * ossSrc 过期时间相关工具
 * 格式: 2026-03-03 11:14:03（按本地时间解析）
 */

/**
 * Signed OSS URLs must retain a small usable window after a caller receives
 * them. This gives clipboard writes and the following paste/download time to
 * complete instead of handing consumers a link that is technically valid but
 * about to expire.
 */
export const OSS_URL_EXPIRY_SAFETY_WINDOW_MS = 30_000

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
 * 判断 ossSrc 是否已过期
 * @param expiresAtTs 过期时间戳，null 表示永不过期
 */
export function isOssExpired(expiresAtTs: number | null): boolean {
	if (expiresAtTs === null) return false
	return Date.now() >= expiresAtTs
}

/**
 * Treat a signed URL inside the safety window as unusable for new work.
 * Missing legacy expiry metadata remains compatible with the existing TTL
 * fallback owned by the URL cache.
 */
export function isOssExpiring(
	expiresAt: string | undefined,
	safetyWindowMs = OSS_URL_EXPIRY_SAFETY_WINDOW_MS,
): boolean {
	const expiresAtTs = parseExpiresAt(expiresAt)
	return expiresAtTs !== null && expiresAtTs - Date.now() <= safetyWindowMs
}
