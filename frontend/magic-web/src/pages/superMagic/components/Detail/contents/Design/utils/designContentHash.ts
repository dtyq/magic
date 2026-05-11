import type { DesignData } from "../types"

function getComparablePayload(data: DesignData) {
	return {
		type: data.type,
		name: data.name,
		version: data.version,
		canvas: { elements: data.canvas?.elements || [] },
	}
}

/**
 * 快速指纹：用于自动保存「是否有变更」判断，避免在 stateBag 中长期持有整段 JSON 字符串。
 * 仍在每次比较时构造 payload 并序列化一次；收益主要是内存与引用稳定性。
 */
export function djb2Hash(str: string): number {
	let hash = 5381
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
	}
	return hash >>> 0
}

export function hashDesignDataComparable(data: DesignData): string {
	const payload = JSON.stringify(getComparablePayload(data))
	return `${payload.length}:${djb2Hash(payload)}`
}
