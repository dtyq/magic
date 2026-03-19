import {
	type MessageEditorLayoutConfig,
	type MessageEditorModuleConfig,
	type MessageEditorMCPModuleConfig,
	type MessageEditorModules,
	type MessageEditorUploadModuleConfig,
	ToolbarButton,
} from "../types"
import type { MessageEditorProviderConfig } from "../MessageEditorProvider/types"

export interface ResolvedMessageEditorModuleConfig {
	enabled: boolean
}

export interface ResolvedMessageEditorUploadModuleConfig extends ResolvedMessageEditorModuleConfig {
	confirmDelete: boolean
}

export interface ResolvedMessageEditorMCPModuleConfig extends ResolvedMessageEditorModuleConfig {
	storageKey?: string
	useTempStorage: boolean
}

export interface ResolvedMessageEditorModules {
	mention: ResolvedMessageEditorModuleConfig
	aiCompletion: ResolvedMessageEditorModuleConfig
	mcp: ResolvedMessageEditorMCPModuleConfig
	upload: ResolvedMessageEditorUploadModuleConfig
	voiceInput: ResolvedMessageEditorModuleConfig
}

const LAYOUT_SLOTS: (keyof MessageEditorLayoutConfig)[] = [
	"topBarLeft",
	"topBarRight",
	"bottomLeft",
	"bottomRight",
	"outsideBottom",
	"outsideTop",
]

export const DEFAULT_MESSAGE_EDITOR_MODULES: ResolvedMessageEditorModules = {
	mention: {
		enabled: true,
	},
	aiCompletion: {
		enabled: true,
	},
	mcp: {
		enabled: true,
		useTempStorage: false,
	},
	upload: {
		enabled: true,
		confirmDelete: true,
	},
	voiceInput: {
		enabled: true,
	},
}

export function resolveModuleEnabled(
	moduleConfig: MessageEditorModuleConfig | undefined,
	legacyEnabled: boolean | undefined,
	defaultEnabled = true,
) {
	return moduleConfig?.enabled ?? legacyEnabled ?? defaultEnabled
}

export function hasToolbarButton(
	layoutConfig: MessageEditorLayoutConfig | undefined,
	button: ToolbarButton,
) {
	if (!layoutConfig) return false

	return LAYOUT_SLOTS.some((slot) => layoutConfig[slot]?.includes(button))
}

function resolveUploadModule(
	moduleConfig: MessageEditorUploadModuleConfig | undefined,
	layoutConfig: MessageEditorLayoutConfig | undefined,
) {
	return {
		enabled: resolveModuleEnabled(
			moduleConfig,
			layoutConfig ? hasToolbarButton(layoutConfig, ToolbarButton.UPLOAD) : undefined,
			DEFAULT_MESSAGE_EDITOR_MODULES.upload.enabled,
		),
		confirmDelete:
			moduleConfig?.confirmDelete ?? DEFAULT_MESSAGE_EDITOR_MODULES.upload.confirmDelete,
	}
}

function resolveMCPModule(
	moduleConfig: MessageEditorMCPModuleConfig | undefined,
	layoutConfig: MessageEditorLayoutConfig | undefined,
) {
	return {
		enabled: resolveModuleEnabled(
			moduleConfig,
			layoutConfig ? hasToolbarButton(layoutConfig, ToolbarButton.MCP) : undefined,
			DEFAULT_MESSAGE_EDITOR_MODULES.mcp.enabled,
		),
		storageKey: moduleConfig?.storageKey,
		useTempStorage:
			moduleConfig?.useTempStorage ?? DEFAULT_MESSAGE_EDITOR_MODULES.mcp.useTempStorage,
	}
}

export function resolveMessageEditorModules({
	modules,
	layoutConfig,
	providerConfig,
}: {
	modules?: MessageEditorModules
	layoutConfig?: MessageEditorLayoutConfig
	providerConfig?: MessageEditorProviderConfig
}): ResolvedMessageEditorModules {
	return {
		mention: {
			enabled: resolveModuleEnabled(
				modules?.mention,
				layoutConfig ? hasToolbarButton(layoutConfig, ToolbarButton.AT) : undefined,
				DEFAULT_MESSAGE_EDITOR_MODULES.mention.enabled,
			),
		},
		aiCompletion: {
			enabled: resolveModuleEnabled(
				modules?.aiCompletion,
				undefined,
				DEFAULT_MESSAGE_EDITOR_MODULES.aiCompletion.enabled,
			),
		},
		mcp: resolveMCPModule(modules?.mcp, layoutConfig),
		upload: resolveUploadModule(modules?.upload, layoutConfig),
		voiceInput: {
			enabled: resolveModuleEnabled(
				modules?.voiceInput,
				layoutConfig
					? hasToolbarButton(layoutConfig, ToolbarButton.VOICE_INPUT)
					: providerConfig?.enableVoiceInput,
				DEFAULT_MESSAGE_EDITOR_MODULES.voiceInput.enabled,
			),
		},
	}
}
