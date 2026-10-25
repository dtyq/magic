import { STUDY_PHASE_KEYS } from "@/pages/superMagic/pages/PersonaResearch/types"
import type {
	StudyPhaseKey,
	StudyPhaseStatus,
} from "@/pages/superMagic/pages/PersonaResearch/types"

/**
 * AI 研究三张工具卡片的数据读取。字段与后端 server_message.py 中的
 * StudyProgressContent / PersonaChatContent / StudyPersonasContent 一一对应。
 *
 * | 来源 | 什么时候有 | 读取函数 |
 * | detail（结构化） | 工具结束后 | getStudyProgress / getPersonaChat / getStudyPersonas |
 * | rawArguments | 执行中，detail 还没到 | getPersonaChatArguments / getStudyPersonasArguments |
 *
 * 老消息是 Markdown detail，读取结果为 null，卡片退回默认样式。字段缺失或损坏时丢掉坏条目，不抛错。
 */

export interface PortraitHint {
	gender: string
	age: string
}

export interface StudyProgressData {
	/** 当前阶段；全部完成时为 done */
	phase: StudyPhaseKey | "done"
	phases: { key: StudyPhaseKey; status: StudyPhaseStatus }[]
}

export interface PersonaChatAnswer extends PortraitHint {
	persona_id: string
	name: string
	text: string
}

export interface PersonaChatFailure extends PortraitHint {
	persona_id: string
	name: string
	reason: string
}

export interface PersonaChatData {
	question: string
	round_number?: number
	round_limit?: number
	answers: PersonaChatAnswer[]
	failed: PersonaChatFailure[]
	/** 整次请求被拒时的原因（已翻译）；此时 answers、failed 都为空 */
	error: string
	/** error 对应的原因码（如 invalid_request）；旧消息没有 */
	error_reason: string
}

/**
 * 「访谈参数不正确，AI 会修正后重试」是 AI 自己会改的可预期失败，不是要用户处理的错误：
 * 用琥珀色而不是红色。旧消息没有原因码，只能比对后端翻译后的文案。
 */
const SELF_CORRECTING_REASONS = new Set(["invalid_request"])
const SELF_CORRECTING_TEXTS = new Set([
	"访谈参数不正确，AI 会修正后重试",
	"The interview request was invalid; the AI will correct it and retry",
])

export function isSelfCorrectingError(error: string, errorReason = ""): boolean {
	return SELF_CORRECTING_REASONS.has(errorReason) || SELF_CORRECTING_TEXTS.has(error.trim())
}

export interface StudyPersonaItem extends PortraitHint {
	persona_id: string
	name: string
	tagline: string
	segment: string
	reused: boolean
}

export interface StudyPersonasData {
	panel_name: string
	new_count: number
	reused_count: number
	personas: StudyPersonaItem[]
}

/** 执行中从调用参数里能拿到的人设：persona_chat 只有档案路径，save_personas 有名字 */
export interface PendingPersona {
	persona_id: string
	name: string
}

const PHASE_STATUSES = new Set<StudyPhaseStatus>([
	"done",
	"running",
	"pending",
	"skipped",
	"failed",
])

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string {
	return typeof value === "string" ? value.trim() : ""
}

function readPositiveInt(value: unknown): number | undefined {
	return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined
}

function readCount(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback
}

function readHint(value: Record<string, unknown>): PortraitHint {
	return { gender: readString(value.gender), age: readString(value.age) }
}

function detailData(detail: unknown, type: string): Record<string, unknown> | null {
	if (!isRecord(detail) || detail.type !== type || !isRecord(detail.data)) return null
	return detail.data
}

function isPhaseKey(value: unknown): value is StudyPhaseKey {
	return (STUDY_PHASE_KEYS as readonly unknown[]).includes(value)
}

export function getStudyProgress(detail: unknown): StudyProgressData | null {
	const data = detailData(detail, "study_progress")
	if (!data || !Array.isArray(data.phases)) return null
	const byKey = new Map<StudyPhaseKey, StudyPhaseStatus>()
	for (const item of data.phases) {
		if (!isRecord(item) || !isPhaseKey(item.key)) continue
		const status = item.status as StudyPhaseStatus
		byKey.set(item.key, PHASE_STATUSES.has(status) ? status : "pending")
	}
	if (byKey.size === 0) return null
	// 始终按 6 个阶段输出，缺失的阶段按未开始显示，迷你进度条不会少格。
	const phases = STUDY_PHASE_KEYS.map((key) => ({ key, status: byKey.get(key) ?? "pending" }))
	const phase = data.phase === "done" || isPhaseKey(data.phase) ? data.phase : "clarify"
	return { phase, phases }
}

export function getPersonaChat(detail: unknown): PersonaChatData | null {
	const data = detailData(detail, "persona_chat")
	if (!data) return null
	const answers = (Array.isArray(data.answers) ? data.answers : [])
		.filter(isRecord)
		.map((item) => ({
			persona_id: readString(item.persona_id),
			name: readString(item.name) || readString(item.persona_id),
			text: readString(item.text),
			...readHint(item),
		}))
		.filter((item) => item.persona_id && item.text)
	const failed = (Array.isArray(data.failed) ? data.failed : [])
		.filter(isRecord)
		.map((item) => ({
			persona_id: readString(item.persona_id),
			name: readString(item.name) || readString(item.persona_id),
			reason: readString(item.reason),
			...readHint(item),
		}))
		.filter((item) => item.persona_id)
	return {
		question: readString(data.question),
		round_number: readPositiveInt(data.round_number),
		round_limit: readPositiveInt(data.round_limit),
		answers,
		failed,
		error: readString(data.error),
		error_reason: readString(data.error_reason),
	}
}

export function getStudyPersonas(detail: unknown): StudyPersonasData | null {
	const data = detailData(detail, "study_personas")
	if (!data || !Array.isArray(data.personas)) return null
	const personas = data.personas
		.filter(isRecord)
		.map((item) => ({
			persona_id: readString(item.persona_id),
			name: readString(item.name) || readString(item.persona_id),
			tagline: readString(item.tagline),
			segment: readString(item.segment),
			reused: item.reused === true,
			...readHint(item),
		}))
		.filter((item) => item.persona_id)
	if (personas.length === 0) return null
	const reused = personas.filter((item) => item.reused).length
	return {
		panel_name: readString(data.panel_name),
		new_count: readCount(data.new_count, personas.length - reused),
		reused_count: readCount(data.reused_count, reused),
		personas,
	}
}

function parseArguments(rawArguments: string | undefined): Record<string, unknown> | null {
	if (!rawArguments) return null
	try {
		const parsed: unknown = JSON.parse(rawArguments)
		return isRecord(parsed) ? parsed : null
	} catch {
		// 流式输出中参数可能还不完整，执行中只是少显示内容
		return null
	}
}

/** personas/p_zhang_1a2b.json → p_zhang_1a2b */
function personaIdFromPath(path: string): string {
	const file = path.split("/").pop() ?? ""
	return file.replace(/\.json$/i, "")
}

/** 执行中的 persona_chat：问题和受访者都来自调用参数；名字要等档案读出后才知道 */
export function getPersonaChatArguments(rawArguments: string | undefined): {
	question: string
	round_number?: number
	personas: PendingPersona[]
} | null {
	const args = parseArguments(rawArguments)
	if (!args) return null
	const personas = (Array.isArray(args.persona_paths) ? args.persona_paths : [])
		.map((path) => personaIdFromPath(readString(path)))
		.filter(Boolean)
		.map((id) => ({ persona_id: id, name: "" }))
	const question = readString(args.question)
	if (!question && personas.length === 0) return null
	return {
		question,
		// 只有写入访谈记录时 round_number 才有意义
		round_number: readString(args.transcript_path)
			? readPositiveInt(args.round_number)
			: undefined,
		personas,
	}
}

/** 执行中的 save_personas：复用的人设只有 ID，新人设只有名字（ID 由工具生成） */
export function getStudyPersonasArguments(rawArguments: string | undefined): PendingPersona[] {
	const args = parseArguments(rawArguments)
	if (!args || !Array.isArray(args.personas)) return []
	return args.personas.filter(isRecord).map((item, index) => {
		const id = readString(item.id)
		const name = readString(item.name)
		return { persona_id: id || `pending-${index}`, name: name || id }
	})
}
