import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import superMagicModeService from "./SuperMagicModeService"

export interface DefaultAgentSelection {
	modeIdentifier: string
	topicPattern: TopicMode
	agentCode?: string
}

const builtInTopicModes = new Set<string>([
	TopicMode.General,
	TopicMode.DataAnalysis,
	TopicMode.PPT,
	TopicMode.Report,
	TopicMode.RecordSummary,
	TopicMode.Design,
])

function normalizeAgentCode(agentCode?: string | null) {
	return agentCode?.trim() || undefined
}

function createGeneralSelection(): DefaultAgentSelection {
	return {
		modeIdentifier: TopicMode.General,
		topicPattern: TopicMode.General,
	}
}

/** UI/storage fallback when no topic or saved mode is present. */
export function getFallbackTopicModeIdentifier(): TopicMode {
	return resolveDefaultAgentSelection().modeIdentifier as TopicMode
}

/** project_mode for create-project when caller did not specify one. */
export function resolveProjectModeForCreate(projectMode?: TopicMode | string | null): TopicMode {
	const normalized = projectMode?.toString().trim()
	if (normalized) return normalized as TopicMode
	return getFallbackTopicModeIdentifier()
}

/**
 * Whether the resolved selection is still available to the current user.
 */
export function isAgentSelectionAvailable(
	modeIdentifier?: string | null,
	explicitAgentCode?: string | null,
) {
	const selection = resolveAgentSelection(modeIdentifier, explicitAgentCode)

	if (
		selection.topicPattern === TopicMode.General &&
		selection.modeIdentifier === TopicMode.General
	) {
		return true
	}

	return superMagicModeService.isModeValid(selection.topicPattern, selection.agentCode)
}

/**
 * 解析平台配置的默认员工。配置只在员工对当前用户可用时生效。
 */
export function resolveDefaultAgentSelection(): DefaultAgentSelection {
	const defaultAgentCode = normalizeAgentCode(superMagicModeService.defaultAgentCode)

	if (!defaultAgentCode) {
		return createGeneralSelection()
	}
	if (defaultAgentCode === TopicMode.General) return createGeneralSelection()
	if (!superMagicModeService.isModeValid(defaultAgentCode)) return createGeneralSelection()

	if (builtInTopicModes.has(defaultAgentCode)) {
		return {
			modeIdentifier: defaultAgentCode,
			topicPattern: defaultAgentCode as TopicMode,
		}
	}

	if (defaultAgentCode.startsWith("SMA")) {
		return {
			modeIdentifier: defaultAgentCode,
			topicPattern: TopicMode.CustomAgent,
			agentCode: defaultAgentCode,
		}
	}

	return {
		modeIdentifier: defaultAgentCode,
		topicPattern: defaultAgentCode as TopicMode,
	}
}

/**
 * 将界面模式标识转换成话题和发送协议。
 * 已有话题提供的 custom_agent + agent_code 优先，不校验员工列表，避免覆盖历史话题。
 */
export function resolveAgentSelection(
	modeIdentifier?: string | null,
	explicitAgentCode?: string | null,
): DefaultAgentSelection {
	const normalizedMode = modeIdentifier?.trim()
	const normalizedAgentCode = normalizeAgentCode(explicitAgentCode)

	if (normalizedAgentCode && normalizedMode === TopicMode.CrewCreator) {
		return {
			modeIdentifier: TopicMode.CrewCreator,
			topicPattern: TopicMode.CrewCreator,
			agentCode: normalizedAgentCode,
		}
	}

	if (
		normalizedAgentCode &&
		(normalizedMode === TopicMode.CustomAgent || normalizedMode === normalizedAgentCode)
	) {
		return {
			modeIdentifier: normalizedAgentCode,
			topicPattern: TopicMode.CustomAgent,
			agentCode: normalizedAgentCode,
		}
	}

	const defaultSelection = resolveDefaultAgentSelection()
	if (defaultSelection.agentCode && normalizedMode === defaultSelection.modeIdentifier) {
		return defaultSelection
	}

	// 保留现有自定义员工识别规则；平台默认员工不依赖此前缀判断。
	if (normalizedMode?.startsWith("SMA")) {
		return {
			modeIdentifier: normalizedMode,
			topicPattern: TopicMode.CustomAgent,
			agentCode: normalizedMode,
		}
	}

	if (!normalizedMode || normalizedMode === TopicMode.CustomAgent) {
		return resolveDefaultAgentSelection()
	}

	return {
		modeIdentifier: normalizedMode,
		topicPattern: normalizedMode as TopicMode,
	}
}
