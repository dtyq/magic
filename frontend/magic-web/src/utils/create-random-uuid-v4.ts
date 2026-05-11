/**
 * 生成 RFC 4122 风格的 UUID v4 字符串（全局通用，与业务里的 generateUUID 命名区分）
 * 优先 `crypto.randomUUID`，否则降级为 Math.random 模板填充
 */
export function createRandomUuidV4(): string {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID()
	}

	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0
		const v = c === "x" ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}
