import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type MouseEvent,
	type ReactNode,
} from "react"
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover"
import { cn } from "../../../lib/utils"
import { useMagic } from "../../../context/MagicContext"
import { useCanvasDesignI18n } from "../../../context/I18nContext"
import {
	REFERENCE_RESOURCE_SOURCE_TYPES,
	type ReferenceResourceFileInfo,
	type ReferenceAssetPerTypeLimits,
	type ReferenceAssetTypeCounts,
	type ReferenceResourceSourceOption,
	type ReferenceResourceSourceType,
	type ReferenceResourceTypeFilter,
} from "./reference-resource.types"
import type {
	ReferenceResourcePanelItem,
	ReferenceResourcePanelSelectContext,
} from "../../../types"
import { useReferenceResourcePanelDataService } from "./useReferenceResourcePanelDataService"
import { FolderOpen, Upload } from "lucide-react"

function defaultIconForSourceType(source: ReferenceResourceSourceType) {
	if (source === REFERENCE_RESOURCE_SOURCE_TYPES.localUpload)
		return <Upload size={16} className="shrink-0 text-foreground" aria-hidden strokeWidth={5} />
	if (source === REFERENCE_RESOURCE_SOURCE_TYPES.projectSelect)
		return (
			<FolderOpen
				size={16}
				className="shrink-0 text-foreground"
				aria-hidden
				strokeWidth={5}
			/>
		)
	return null
}

interface ReferenceResourcePopoverProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onMouseEnter: () => void
	onMouseLeave: () => void
	trigger: ReactNode
	/** 不传时使用内置「本地上传 / 项目选择」文案与默认禁用逻辑 */
	sourceOptions?: ReferenceResourceSourceOption[]
	onSelectSource: (source: ReferenceResourceSourceType) => void
	maxReferenceFiles?: number
	currentReferenceFiles?: string[]
	isReferenceFileLimitReached?: boolean
	referenceResourceType: ReferenceResourceTypeFilter
	referenceFileInfos: ReferenceResourceFileInfo[]
	assetLimits?: ReferenceAssetPerTypeLimits
	currentAssetCounts?: ReferenceAssetTypeCounts
	onProjectSelect?: (
		item: ReferenceResourcePanelItem,
		context?: ReferenceResourcePanelSelectContext,
	) => void
	hoverContent?: ReactNode
	clickContent?: ReactNode
	triggerClassName?: string
	contentClassName?: string
	bodyClassName?: string
	sourceActionsClassName?: string
	sourceActionClassName?: string
	/** 项目文件选择面板（ReferenceResourcePanel）展开/收起时通知宿主，用于保持外层布局（如 SourceList keepOpen） */
	onProjectSelectPanelOpenChange?: (visible: boolean) => void
}

export default function ReferenceResourcePopover(props: ReferenceResourcePopoverProps) {
	const {
		open,
		onOpenChange,
		onMouseEnter,
		onMouseLeave,
		trigger,
		sourceOptions: sourceOptionsProp,
		onSelectSource,
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		referenceResourceType,
		referenceFileInfos,
		assetLimits,
		currentAssetCounts,
		onProjectSelect,
		hoverContent,
		clickContent,
		triggerClassName,
		contentClassName,
		bodyClassName,
		sourceActionsClassName,
		sourceActionClassName,
		onProjectSelectPanelOpenChange,
	} = props
	const { t } = useCanvasDesignI18n()
	const {
		referenceResourcePanelRenderer: ReferenceResourcePanelRenderer,
		defaultProjectAttachmentFolderName,
	} = useMagic()
	const [displayMode, setDisplayMode] = useState<"hover" | "click">("click")
	const [isProjectSelectVisible, setIsProjectSelectVisible] = useState(false)
	const internalTriggerRef = useRef<HTMLDivElement>(null)
	/** Radix Trigger 在已打开时再次点击会 onOpenChange(false)；hover 态下应转为 click 态并保持打开 */
	const suppressNextTriggerCloseRef = useRef(false)
	/** 点击「从项目选择」时 Radix 会在 onClick 前派发关闭；capture 阶段置位以维持外层 Popover 打开 */
	const suppressNextContentDismissRef = useRef(false)
	/** 用户已在 trigger 上 pointerdown 进入「本地上传/项目选择」态；此时不应因浮层 mouseenter 退回 hover 列表 */
	const userChoseClickModeRef = useRef(false)

	useEffect(() => {
		if (!open) {
			suppressNextTriggerCloseRef.current = false
			suppressNextContentDismissRef.current = false
			userChoseClickModeRef.current = false
		}
	}, [open])

	// 仅在本实例真正打开/关闭项目面板时通知宿主；挂载时不要用 false 覆盖其它槽位已打开的面板
	useEffect(() => {
		if (isProjectSelectVisible) {
			onProjectSelectPanelOpenChange?.(true)
		}
		return () => {
			if (isProjectSelectVisible) {
				onProjectSelectPanelOpenChange?.(false)
			}
		}
	}, [isProjectSelectVisible, onProjectSelectPanelOpenChange])

	const projectSelectDataService = useReferenceResourcePanelDataService({
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		referenceResourceType,
		referenceFileInfos,
		assetLimits,
		currentAssetCounts,
		projectFilesPathPrefix: t("referenceAssets.projectFilesRoot", "当前项目文件"),
		mentionFileSubtitleParentPrefix: defaultProjectAttachmentFolderName?.trim() || undefined,
	})
	const currentContent = useMemo(() => {
		if (displayMode === "hover") return hoverContent
		return clickContent
	}, [clickContent, displayMode, hoverContent])

	const defaultSourceOptions = useMemo((): ReferenceResourceSourceOption[] => {
		return [
			{
				value: REFERENCE_RESOURCE_SOURCE_TYPES.localUpload,
				label: t("referenceAssets.localUpload", "从本地上传"),
				disabled: Boolean(isReferenceFileLimitReached),
			},
			{
				value: REFERENCE_RESOURCE_SOURCE_TYPES.projectSelect,
				label: t("referenceAssets.projectSelect", "从项目选择"),
				disabled: false,
			},
		]
	}, [t, isReferenceFileLimitReached])

	const sourceOptions = sourceOptionsProp ?? defaultSourceOptions
	const shouldRenderSourceActions = displayMode === "click" && sourceOptions.length > 0

	const handleProjectSelectClose = useCallback(() => {
		setIsProjectSelectVisible(false)
	}, [])

	const handleRootOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen && suppressNextTriggerCloseRef.current) {
				suppressNextTriggerCloseRef.current = false
				onOpenChange(true)
				return
			}
			if (!nextOpen && suppressNextContentDismissRef.current) {
				suppressNextContentDismissRef.current = false
				onOpenChange(true)
				return
			}
			onOpenChange(nextOpen)
		},
		[onOpenChange],
	)

	const handlePopoverHostMouseLeave = useCallback(
		(event: MouseEvent<HTMLElement>) => {
			const rt = event.relatedTarget
			if (isProjectSelectVisible) return
			if (rt instanceof Element && rt.closest("[data-mention-panel]")) return
			onMouseLeave()
		},
		[isProjectSelectVisible, onMouseLeave],
	)

	const handleReferencePopoverInteractOutside = useCallback((event: Event) => {
		const target = event.target
		if (target instanceof Element && target.closest("[data-mention-panel]")) {
			event.preventDefault()
		}
	}, [])

	const handleProjectSelectPointerDownCapture = useCallback(() => {
		suppressNextContentDismissRef.current = true
	}, [])

	const handleSourceSelect = useCallback(
		(source: ReferenceResourceSourceType) => {
			onSelectSource(source)
			if (source !== REFERENCE_RESOURCE_SOURCE_TYPES.projectSelect) return
			if (!ReferenceResourcePanelRenderer || !projectSelectDataService) {
				suppressNextContentDismissRef.current = false
				return
			}
			setIsProjectSelectVisible(true)
		},
		[ReferenceResourcePanelRenderer, onSelectSource, projectSelectDataService],
	)

	const handleProjectSelect = useCallback(
		(item: ReferenceResourcePanelItem, context?: ReferenceResourcePanelSelectContext) => {
			onProjectSelect?.(item, context)
			if (context?.reset) {
				handleProjectSelectClose()
			}
		},
		[handleProjectSelectClose, onProjectSelect],
	)

	return (
		<>
			<Popover open={open} onOpenChange={handleRootOpenChange}>
				<PopoverTrigger asChild>
					<div
						ref={internalTriggerRef}
						className={triggerClassName}
						onMouseEnter={() => {
							if (hoverContent) {
								setDisplayMode("hover")
								onMouseEnter()
							}
						}}
						onMouseLeave={hoverContent ? handlePopoverHostMouseLeave : undefined}
						onPointerDown={() => {
							if (!hoverContent || !open) return
							if (displayMode !== "hover") return
							suppressNextTriggerCloseRef.current = true
							userChoseClickModeRef.current = true
							setDisplayMode("click")
						}}
					>
						{trigger}
					</div>
				</PopoverTrigger>
				<PopoverContent
					data-canvas-ui-component
					align="start"
					onInteractOutside={handleReferencePopoverInteractOutside}
					onOpenAutoFocus={(event) => {
						// 阻止打开时焦点落到第一个 button，避免出现「默认选中」的高亮
						event.preventDefault()
					}}
					onCloseAutoFocus={(event) => {
						event.preventDefault()
					}}
					onMouseEnter={() => {
						onMouseEnter()
						// trigger leave → 延迟关窗 → 再被 content enter 打开时，不会经过 trigger 的 mouseenter；
						// 若曾在关窗时把 displayMode 打成 click，会误显示「点击菜单」。未主动选 click 时恢复为 hover。
						if (hoverContent && !userChoseClickModeRef.current) {
							setDisplayMode("hover")
						}
					}}
					onMouseLeave={handlePopoverHostMouseLeave}
					className={cn(
						contentClassName,
						/* 来源菜单：窄宽 + 4px 内边距；参考图列表：固定 320px + 10px 内边距 */
						shouldRenderSourceActions
							? "!w-max min-w-[150px] max-w-[min(100vw-2rem,20rem)] !p-1"
							: "!w-[320px] !p-2.5",
					)}
				>
					<div className={bodyClassName}>
						{shouldRenderSourceActions && (
							<div
								className={cn("flex w-full flex-col gap-0", sourceActionsClassName)}
							>
								{sourceOptions.map((option) => (
									<button
										key={option.value}
										type="button"
										className={cn(
											"relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm font-normal text-popover-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
											sourceActionClassName,
										)}
										disabled={option.disabled}
										{...(option.value ===
										REFERENCE_RESOURCE_SOURCE_TYPES.projectSelect
											? {
													onPointerDownCapture:
														handleProjectSelectPointerDownCapture,
												}
											: {})}
										onMouseDown={(event) => {
											event.preventDefault()
										}}
										onClick={() => handleSourceSelect(option.value)}
									>
										{option.icon ?? defaultIconForSourceType(option.value)}
										<span className="min-w-0 flex-1">{option.label}</span>
									</button>
								))}
							</div>
						)}
						{currentContent}
					</div>
				</PopoverContent>
			</Popover>
			{ReferenceResourcePanelRenderer && projectSelectDataService && (
				<ReferenceResourcePanelRenderer
					visible={isProjectSelectVisible}
					triggerRef={internalTriggerRef as React.RefObject<HTMLElement | null>}
					language="zh-CN"
					onSelect={handleProjectSelect}
					onClose={handleProjectSelectClose}
					dataService={projectSelectDataService}
				/>
			)}
		</>
	)
}
