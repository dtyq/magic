import {
	DetailType,
	type DetailSubagentItem,
	type DetailSubagentsData,
} from "@/pages/superMagic/components/Detail/types"

/** 同一张卡片先是等待中（waiting），等待结束后就地变成结果态（settled） */
const SUBAGENTS_PHASES = new Set<DetailSubagentsData["phase"]>(["waiting", "settled"])

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value ? value : undefined
}

function readNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function parseAgent(value: unknown): DetailSubagentItem | null {
	if (!isRecord(value)) return null
	const agentId = readString(value.agent_id)
	const status = readString(value.status)
	if (!agentId || !status) return null
	return {
		agent_id: agentId,
		label: readString(value.label) ?? agentId,
		status,
		elapsed_seconds: readNumber(value.elapsed_seconds),
		last_activity: readString(value.last_activity),
		result: readString(value.result),
		error: readString(value.error),
	}
}

/**
 * 读取 wait_for_subagents 的卡片数据。
 * 老消息（终端文本形状）、字段缺失或损坏时返回 null 或丢掉坏条目，卡片只会少显示内容，不会渲染报错。
 */
export function getSubagentsDetailData(detail: unknown): DetailSubagentsData | null {
	if (!isRecord(detail) || detail.type !== DetailType.Subagents || !isRecord(detail.data)) {
		return null
	}
	const data = detail.data
	const agents = Array.isArray(data.agents)
		? data.agents.map(parseAgent).filter((item): item is DetailSubagentItem => item !== null)
		: []
	const phase = SUBAGENTS_PHASES.has(data.phase as DetailSubagentsData["phase"])
		? (data.phase as DetailSubagentsData["phase"])
		: "waiting"
	return {
		progress: readNumber(data.progress) ?? 0,
		indeterminate: data.indeterminate === true,
		message: readString(data.message) ?? "",
		total_agents: readNumber(data.total_agents) ?? agents.length,
		finished_agents: readNumber(data.finished_agents) ?? 0,
		elapsed_seconds: readNumber(data.elapsed_seconds) ?? 0,
		phase,
		agents,
	}
}
