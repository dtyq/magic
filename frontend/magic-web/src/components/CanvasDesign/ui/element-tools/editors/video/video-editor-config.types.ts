import type React from "react"
import type { VideoElement } from "../../../../runtime/document/types"
import type {
	MessageEditorMentionChangeContext,
	MessageEditorRef,
} from "../../../editors/message/MessageEditor"
import type {
	GenerateVideoRequest,
	StoredLinkedFrameBinding,
	StoredVideoEditorDraft,
	StoredVideoModeInputDraft,
	UploadFileResponse,
	VideoInputMode,
	VideoInputModeConfig,
	VideoModelItem,
	VideoGenerationDurationRange,
} from "../../../../public/magic-types"
import type { MediaEditIntent } from "../../../../runtime/interaction/media-edit-recovery/MediaEditRecoveryManager"
import type {
	ReferenceAssetPerTypeLimits,
	ReferenceAssetTypeCounts,
	ReferenceResourceAssetType,
	ReferenceResourceType,
} from "../../../editors/message/reference-assets/reference-resource.types"
import type { ReferenceBindingMode } from "../../../editors/message/reference-assets/referenceBinding"
import type { ReferenceResourceMetadataCandidate } from "../../../editors/message/reference-assets/referenceResourceDescriptor"
import type {
	MatchableMentionItem,
	MentionPathBinding,
} from "../../../editors/message/tiptap/contentUtils"
import type {
	CanvasUploadMentionController,
	CanvasUploadMentionHandle,
} from "../../../editors/message/CanvasUploadMentionController"

/** useVideoEditorConfig 的入参 */
export interface UseVideoEditorConfigOptions {
	videoElement: VideoElement
	/** 画布 MessageEditor ref：参考素材变更时通过 insertMentionItems 插入 @ 文件 */
	messageEditorRef?: React.RefObject<MessageEditorRef | null>
	/**
	 * 首次恢复：preferDraft 合并临时草稿与已保存请求；
	 * originalRequestOnly 忽略临时草稿与各模式缓存，仅以 generateVideoRequest 为准（成片后「重新生成」）；
	 * quickEdit 以当前视频作为唯一 reference_videos 初始化快捷编辑。
	 */
	restoreOnMount?: "preferDraft" | "originalRequestOnly" | "quickEdit"
	sessionSnapshot?: VideoEditSessionSnapshot
	/** 是否由该配置 hook 管理普通 Canvas 内存恢复；二次编辑由外层意图会话管理。 */
	manageRecoverySession?: boolean
	recoveryIntent?: MediaEditIntent
	/** 尺寸选择变化时是否同步更新当前 videoElement；结果态重新编辑生成新元素时应关闭 */
	syncElementSize?: boolean
	/** 当前有效的画布联动参考媒体，仅用于添加入口的统一计数，不由该 hook 持久化。 */
	getAdditionalReferenceAssetInfos?: () => readonly VideoReferenceAssetInfo[]
}

export interface VideoModelOption {
	label: string
	value: string
	model: VideoModelItem
}

export interface VideoModelOptionGroup {
	id: string
	label: string
	icon?: string
	sort: number
	source: "official" | "custom"
	options: VideoModelOption[]
}

export interface VideoInputSlotInfo {
	inputTab: "frame" | "reference"
	slotIndex: number
	slotKey?: string
	referenceAssetKind?: VideoReferenceAssetKind
	referenceAssetKinds?: VideoReferenceAssetKind[]
	path?: string
}

export type VideoReferenceAssetKind = ReferenceResourceAssetType

export interface VideoReferenceAssetInfo extends UploadFileResponse {
	assetType: VideoReferenceAssetKind
}

/** 首尾帧槽位当前由哪个连线媒体提供，运行时用于展示来源与处理替换。 */
export type LinkedFrameBinding = StoredLinkedFrameBinding

export type VideoEditSessionSnapshot = Omit<StoredVideoEditorDraft, "version" | "updatedAt">

/** 各互斥输入模式下的暂存配置（切换 Tab 时恢复，发送时仅使用当前模式） */
export type VideoModeInputDraft = StoredVideoModeInputDraft

export const VIDEO_INPUT_MODE_ORDER: VideoInputMode[] = [
	"standard",
	"omni_reference",
	"video_edit",
	"keyframe_guided",
	"image_reference",
]

/**
 * 视频编辑器面板用到的状态、下拉选项与事件处理（供 Controls / Render 消费）
 */
export interface VideoEditorConfig {
	selectedModelId: string
	selectedInputMode: VideoInputMode
	availableInputModes: VideoInputMode[]
	currentInputModeConfig?: VideoInputModeConfig
	prompt: string
	selectedResolution?: string
	/** 当前选中的宽高比，如 16:9 */
	selectedAspectRatio?: string
	currentFrameImages: Array<string | undefined>
	frameImageInfos: Array<{ src: string; fileName: string; path: string } | undefined>
	linkedFrameBindings: Array<LinkedFrameBinding | undefined>
	currentReferenceImages: string[]
	protectedReferencePaths: string[]
	referenceBindingMode: ReferenceBindingMode
	referenceImageInfos: Array<{
		src: string
		fileName: string
		path: string
		assetType: VideoReferenceAssetKind
		file_id?: string
		source_file_id?: string
		source_project_id?: string
		project_id?: string
	}>
	mentionBindings: MentionPathBinding[]
	matchableItems: MatchableMentionItem[]
	modelOptions: VideoModelOption[]
	modelOptionGroups: VideoModelOptionGroup[]
	selectedModelOption: VideoModelOption | undefined
	maxFrameImages: number | undefined
	maxReferenceImages: number | undefined
	isReferenceImageLimitReached: boolean
	/** 按类型细分的限制对象，供三入口（拖入/上传/@面板）统一使用 */
	referenceAssetLimits: ReferenceAssetPerTypeLimits
	/** 当前已选各类型资源数量快照 */
	referenceAssetCounts: ReferenceAssetTypeCounts
	isUploading: boolean
	/** 本地上传进行中时，正在写入的槽位 key（`frame-0` / `reference-1`），用于整段上传期保持 loading 与禁用重复打开菜单 */
	resourceUploadSlotKey: string | null
	/** 用户在上传中点了取消后，恢复空槽 UI，直至后台上传结束 */
	uploadUiDismissed: boolean
	/** 当前输入分区：首尾帧或参考图 */
	activeInputTab: "frame" | "reference"
	hasFrameImagesConfigured: boolean
	hasReferenceImagesConfigured: boolean
	/** 模型是否支持首帧（image） */
	supportsStartFrame: boolean
	/** 模型是否支持尾帧（last_frame） */
	supportsEndFrame: boolean
	/** 当前模式是否支持参考素材输入区 */
	supportsReferenceAssets: boolean
	/** 当前模型与输入模式配置是否已完成解析，可用于执行一次性关联初始化。 */
	isReferencePolicyReady: boolean
	/** 当前模式是否支持参考图 */
	supportsReferenceImages: boolean
	/** 当前模式是否支持参考视频 */
	supportsReferenceVideos: boolean
	/** 当前模式是否支持参考音频 */
	supportsReferenceAudios: boolean
	/** 当前参考素材选择器类型 */
	referenceResourceType: ReferenceResourceType
	/** 当前模式的本地上传 accept */
	fileInputAccept: string
	supportedAspectRatioOptions: Array<{
		value: string
		label: string
		width: number
		height: number
		iconWidth: number
		iconHeight: number
		originalLabel: string
		originalValue: string
		originalScale?: string
	}>
	supportedResolutionOptions: Array<{
		label: string
		value: string
		data: { label: string; value: string; scale: string }
	}>
	/** 模型配置的可选时长（秒） */
	supportedDurationOptions: number[]
	/** 时长控件类型与范围配置 */
	durationType: "options" | "range"
	durationRange?: VideoGenerationDurationRange
	/** 压缩质量可选值（模型开启 supports_compression_quality 时） */
	supportedCompressionQualityOptions: string[]
	selectedDurationSeconds: number | undefined
	durationDraftSeconds: number | undefined
	selectedGenerateAudio: boolean | undefined
	selectedWebSearch: boolean | undefined
	/** 样片模式开关；模型未声明 draft 能力时为 undefined */
	selectedDraft: boolean | undefined
	/** 当前模型与输入模式是否存在合法的 480p 样片档位。 */
	canEnableDraft: boolean
	selectedCompressionQuality: string | undefined
	currentSelectValue: string | undefined
	ratioOption:
		| {
				value: string
				label: string
				width: number
				height: number
				iconWidth: number
				iconHeight: number
				originalLabel: string
				originalValue: string
				originalScale?: string
		  }
		| undefined
	isPopoverOpen: boolean
	/** 「从项目选择」展开的文件面板是否可见（主 Popover 可能已关闭） */
	isReferenceProjectPanelOpen: boolean
	selectedResourceSlot: VideoInputSlotInfo | null
	hasRestoredRef: React.RefObject<boolean>
	isRestoringRef: React.RefObject<boolean>
	restoreRevision: number
	handlers: {
		setPrompt: (prompt: string) => void
		setLinkedFrameBindings: React.Dispatch<
			React.SetStateAction<Array<LinkedFrameBinding | undefined>>
		>
		setPopoverOpen: (open: boolean) => void
		setReferenceProjectPanelOpen: (open: boolean) => void
		handleModelChange: (modelId: string) => void
		handleResolutionChange: (value: string) => void
		handleRatioChange: (value: string) => void
		handleDurationChange: (seconds: number) => void
		handleDurationDraftChange: (seconds: number) => void
		handleDurationPopoverOpenChange: (open: boolean) => void
		handleGenerateAudioChange: (value: boolean) => void
		handleWebSearchChange: (value: boolean) => void
		handleDraftChange: (value: boolean) => void
		handleCompressionQualityChange: (value: string) => void
		handleInputModeChange: (value: VideoInputMode) => void
		/** 切换首尾帧 / 参考图 Tab，仅切换 UI 展示 */
		handleInputTabChange: (value: "frame" | "reference") => void
		handleReferenceMentionPathsChange: (
			paths: string[],
			currentPrompt?: string,
			context?: MessageEditorMentionChangeContext,
			metadataCandidates?: readonly ReferenceResourceMetadataCandidate[],
		) => void
		resetSelectedResourceSlot: (expectedSlot?: VideoInputSlotInfo) => void
		prepareResourceSlotSelection: (
			inputTab: "frame" | "reference",
			slotIndex: number,
			options?: {
				slotKey?: string
				referenceAssetKind?: VideoReferenceAssetKind
				referenceAssetKinds?: VideoReferenceAssetKind[]
				path?: string
			},
		) => void
		replaceFrameImageAt: (
			slotIndex: number,
			fileInfo: UploadFileResponse,
			options?: { retainResourceSlot?: boolean },
		) => void
		appendFrameImage: (fileInfo: UploadFileResponse) => boolean
		replaceReferenceImageAt: (
			slotIndex: number,
			fileInfo: UploadFileResponse & { assetType?: VideoReferenceAssetKind },
			options?: {
				retainResourceSlot?: boolean
				mentionPlacement?: "cursor" | "documentEnd"
				suppressPromptMention?: boolean
				/** 用户显式选择已有资源时，确保编辑器追加一次对应的 @mention。 */
				ensurePromptMention?: boolean
			},
		) => void
		replaceSelectedResource: (
			fileInfo: UploadFileResponse,
			options?: { retainResourceSlot?: boolean },
		) => void
		handleReferenceImageRemove: (path: string) => void
		handleFrameImageRemove: (slotIndex: number) => void
		/** 本地上传进行中：取消并忽略后续上传完成回调 */
		cancelPendingResourceUpload: () => void
		/** 同时支持首帧与尾帧时，互换两槽位图片与元数据 */
		handleSwapFramePair: () => void
		handlePopoverMouseEnter: () => void
		handlePopoverMouseLeave: () => void
		buildRequestParams: () => Partial<GenerateVideoRequest>
		saveDraftRequest: (request: Partial<GenerateVideoRequest>) => void
		cancelPendingDraftPersistence: () => void
		/** 清除临时草稿后，将 UI 完整恢复为元素上的 generateVideoRequest */
		restoreOriginalGenerateVideoRequestToUi: () => void
		/** 快捷编辑：清空草稿并以当前视频作为唯一 reference_videos */
		restoreQuickEditConfigToUi: () => void
		buildSessionSnapshot: () => VideoEditSessionSnapshot
		restoreSessionSnapshotToUi: (snapshot: VideoEditSessionSnapshot) => void
		triggerFileSelect: () => void
		uploadReferenceFiles: (
			files: File[],
			options?: {
				ignoreSelectedResourceSlot?: boolean
				retainSelectedResourceSlot?: boolean
				suppressPartialSkippedToast?: boolean
				isCurrent?: () => boolean
				suppressPromptMention?: boolean
				pendingMentionHandles?: Array<CanvasUploadMentionHandle | undefined>
			},
		) => Promise<UploadFileResponse[]>
		uploadMentionController?: CanvasUploadMentionController
		handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
		syncReferenceImagesFromElement: () => void
		updateMentionBindings: (bindings: MentionPathBinding[]) => void
	}
	fileInputRef: React.MutableRefObject<HTMLInputElement | null>
}
