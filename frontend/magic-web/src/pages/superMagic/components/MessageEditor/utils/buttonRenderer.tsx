import React from "react"
import { Editor, JSONContent } from "@tiptap/react"
import { IconArrowUp, IconArrowUpDashed } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import FlexBox from "@/components/base/FlexBox"
import MagicIcon from "@/components/base/MagicIcon"
import { isEmptyJSONContent } from "../utils"

// Components
import { DraftBox } from "../components/DraftBox"
import At from "../components/At"
import InternetSearch from "../components/InternetSearch"
import MCPButton from "@/components/Agent/MCP/MCPButton"
import SuperMagicVoiceInput from "../components/VoiceInput"
import InterruptButton from "../components/InterruptButton"
import UploadHoverPanelButton from "../components/UploadHoverPanelButton"
import TokenUsageButton from "../components/TokenUsageButton"

// Types
import { ToolbarButton, MessageEditorSize } from "../types"
import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { VoiceInputRef } from "@/components/business/VoiceInput"
import { MentionPanelStore } from "@/components/business/MentionPanel/store"
import { ProjectListItem, Topic, TopicMode } from "../../../pages/Workspace/types"
import { getButtonPaddingClass } from "../constants/BUTTON_PADDING_CLASS_MAP"
import { MagicTooltip } from "@/components/base"
import ModelSwitchContainer from "../components/ModelSwitch/ModelSwitchContainer"
import type { DraftStore } from "../stores"
import type { FileUploadStore } from "../stores/FileUploadStore"
import type { FileData } from "../types"

interface MCPButtonRenderConfig {
	enabled: boolean
	storageKey?: string
	useTempStorage: boolean
}

// Button renderer context
export interface ButtonRendererContext {
	// Refs
	voiceInputRef: React.RefObject<VoiceInputRef>
	tiptapEditor: Editor | null

	// UI state
	iconSize: number
	topBarIconSize: number
	size: MessageEditorSize
	value?: JSONContent
	draftStore: DraftStore
	fileUploadStore: FileUploadStore
	shouldEnableMention: boolean
	uploadEnabled: boolean
	sendEnabled: boolean
	sendButtonDisabled: boolean
	showLoading: boolean
	isTaskRunning: boolean
	stopEventLoading: boolean
	isEditingQueueItem: boolean
	isUploadingFiles: boolean
	voiceInputEnabled: boolean

	// Data
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	topicMode?: TopicMode
	mentionPanelStore: MentionPanelStore
	mcpButtonConfig: MCPButtonRenderConfig

	// Handlers
	handleSelectMentionItem: (item: TiptapMentionAttributes) => Promise<void>
	handleFileUploadClick: (files: FileList) => void
	handleRemoveUploadedFile: (file: FileData) => void
	handleSend: () => void
	handleInterrupt: () => void
	handleCompressContext: () => void

	// Props passthrough
	modelSwitch?: React.ReactNode
	editorModeSwitch?: ({ disabled }: { disabled: boolean }) => React.ReactNode

	// i18n
	t: (key: string, options?: Record<string, unknown>) => string

	// Editor value updater for external integrations (e.g., VoiceInput)
	updateEditorValue: (value: JSONContent | undefined) => void
}

type ButtonRenderer = (context: ButtonRendererContext) => React.ReactNode

// Button renderer registry
export const BUTTON_RENDERERS: Record<ToolbarButton, ButtonRenderer> = {
	[ToolbarButton.DRAFT_BOX]: (ctx) => (
		<DraftBox
			draftStore={ctx.draftStore}
			topicName={ctx.selectedTopic?.topic_name}
			iconSize={ctx.topBarIconSize}
		/>
	),

	[ToolbarButton.AT]: (ctx) =>
		ctx.shouldEnableMention ? (
			<At
				onSelect={ctx.handleSelectMentionItem}
				iconSize={ctx.topBarIconSize}
				onClose={() => ctx.tiptapEditor?.commands.focus()}
				mentionPanelStore={ctx.mentionPanelStore}
				showText={false}
				mobileClassName={cn(
					"flex cursor-pointer items-center justify-center rounded-md border-0 bg-fill text-foreground transition-all hover:opacity-80 active:opacity-60",
					"dark:bg-sidebar dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground",
					getButtonPaddingClass(ctx.size),
				)}
			/>
		) : null,
	[ToolbarButton.MODEL_SWITCH]: (ctx) =>
		ctx.modelSwitch ?? (
			<ModelSwitchContainer
				size={ctx.size}
				selectedTopic={ctx.selectedTopic}
				selectedProject={ctx.selectedProject}
				topicMode={ctx.topicMode}
				showName
				showBorder={false}
				placement={ctx.size === "default" ? "bottomLeft" : "top"}
			/>
		),

	[ToolbarButton.INTERNET_SEARCH]: (ctx) => (
		<InternetSearch
			topicId={ctx.selectedTopic?.id}
			iconSize={ctx.iconSize}
			className={getButtonPaddingClass(ctx.size)}
		/>
	),

	[ToolbarButton.MCP]: (ctx) =>
		ctx.mcpButtonConfig.enabled ? (
			<MCPButton
				iconSize={ctx.iconSize}
				size={ctx.size}
				storageKey={ctx.mcpButtonConfig.storageKey ?? ctx.selectedProject?.id}
				useTempStorage={ctx.mcpButtonConfig.useTempStorage}
				className={getButtonPaddingClass(ctx.size)}
			/>
		) : null,

	[ToolbarButton.UPLOAD]: (ctx) =>
		ctx.uploadEnabled ? (
			<UploadHoverPanelButton
				iconSize={ctx.iconSize}
				size={ctx.size}
				onFileChange={ctx.handleFileUploadClick}
				fileUploadStore={ctx.fileUploadStore}
				onRemoveFile={ctx.handleRemoveUploadedFile}
				t={ctx.t}
				className={getButtonPaddingClass(ctx.size)}
			/>
		) : null,

	[ToolbarButton.VOICE_INPUT]: (ctx) =>
		ctx.topicMode !== TopicMode.RecordSummary && ctx.voiceInputEnabled ? (
			<SuperMagicVoiceInput
				ref={ctx.voiceInputRef}
				initValue={ctx.value}
				tiptapEditor={ctx.tiptapEditor}
				updateValue={ctx.updateEditorValue}
				iconSize={ctx.iconSize}
				className={getButtonPaddingClass(ctx.size)}
			/>
		) : null,

	[ToolbarButton.EDITOR_MODE_SWITCH]: (ctx) =>
		ctx.editorModeSwitch?.({ disabled: false }) ?? null,

	[ToolbarButton.SEND_BUTTON]: (ctx) => {
		if (!ctx.sendEnabled) return null

		// Dynamic rendering: show interrupt button when task is running and editor is empty
		// Otherwise show send button
		const shouldShowInterrupt = ctx.isTaskRunning && isEmptyJSONContent(ctx.value)

		if (shouldShowInterrupt) {
			return (
				<InterruptButton
					visible={ctx.isTaskRunning}
					iconSize={ctx.size === "small" ? 24 : 32}
					onInterrupt={ctx.handleInterrupt}
					loading={ctx.stopEventLoading}
				/>
			)
		}

		const renderTooltipTitle = () => {
			// 没有队列
			if (!ctx.showLoading) {
				// 正在上传文件
				if (ctx.isUploadingFiles) {
					return ctx.t("shortcut.uploadingFiles")
				}
				// 可以发送消息
				return ctx.t("shortcut.sendMessage")
			} else {
				// 有队列
				if (ctx.isEditingQueueItem) {
					return ctx.t("shortcut.updateCurrentQueueMessage")
				} else {
					return ctx.t("shortcut.addToTaskQueue")
				}
			}
		}

		return (
			<MagicTooltip title={renderTooltipTitle()}>
				<button
					type="button"
					className={cn(
						"flex items-center justify-center rounded-[8px] border-0 bg-foreground text-background transition-all",
						"dark:bg-sidebar dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground",
						getButtonPaddingClass(ctx.size),
						ctx.sendButtonDisabled
							? "cursor-not-allowed bg-fill text-muted-foreground opacity-70 dark:bg-sidebar"
							: "opacity-100 hover:opacity-90 active:opacity-80",
					)}
					disabled={ctx.sendButtonDisabled}
					onClick={ctx.handleSend}
					data-testid="super-message-editor-send-button"
					data-disabled={ctx.sendButtonDisabled}
					data-loading={ctx.showLoading}
					data-queue-editing={ctx.isEditingQueueItem}
				>
					{ctx.showLoading ? (
						<MagicIcon
							component={IconArrowUpDashed}
							size={ctx.iconSize}
							color="currentColor"
						/>
					) : (
						<IconArrowUp size={ctx.iconSize} />
					)}
				</button>
			</MagicTooltip>
		)
	},

	[ToolbarButton.INTERRUPT_BUTTON]: (ctx) => (
		<InterruptButton
			visible={ctx.isTaskRunning}
			iconSize={ctx.size === "small" ? 24 : 32}
			onInterrupt={ctx.handleInterrupt}
			loading={ctx.stopEventLoading}
		/>
	),
	[ToolbarButton.DIVIDER]: () => <div className="mx-2 h-4 w-px bg-border" />,

	[ToolbarButton.TOKEN_USAGE]: (ctx) => {
		const tokenUsed = ctx.selectedTopic?.token_used
		if (tokenUsed == null || ctx.size === "mobile") return null
		return (
			<TokenUsageButton
				tokenUsed={tokenUsed}
				iconSize={ctx.iconSize}
				size={ctx.size}
				onCompressContext={ctx.handleCompressContext}
			/>
		)
	},
}

// Render slot by button keys
export function renderSlot(
	buttons: ToolbarButton[] | undefined,
	context: ButtonRendererContext,
	gap = 8,
): React.ReactNode {
	const renderedButtons = buttons
		?.map((buttonKey) => {
			const renderer = BUTTON_RENDERERS[buttonKey]
			if (!renderer) return null
			const element = renderer(context)
			if (!element) return null
			return <React.Fragment key={buttonKey}>{element}</React.Fragment>
		})
		.filter(Boolean)

	// Return null if no buttons to render
	if (!renderedButtons || renderedButtons.length === 0) return null

	return (
		<FlexBox gap={gap} align="center">
			{renderedButtons}
		</FlexBox>
	)
}
