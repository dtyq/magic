import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type MouseEvent,
	type PointerEvent,
	type ReactNode,
} from "react"
import { Popover, PopoverContent, PopoverTrigger } from "../../../primitives/shadcn/popover"
import { cn } from "../../../../runtime/shared/lib/utils"
import { useMagic } from "../../../../app/providers/MagicProvider"
import { useCanvasDesignI18n } from "../../../../app/providers/I18nProvider"
import {
	REFERENCE_RESOURCE_SOURCE_TYPES,
	type ReferenceAssetFileClass,
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
} from "../../../../public/props"
import { useCanvasReferenceMentionRuntime } from "./useCanvasReferenceMentionRuntime"
import { filterReferenceResourcePanelBatchItems } from "./referenceResourceSelection"
import { FolderOpen, Upload } from "lucide-react"
import { AssetLibraryIcon } from "../../../primitives/icons/index"

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
	if (source === REFERENCE_RESOURCE_SOURCE_TYPES.assets)
		return <AssetLibraryIcon size={16} className="shrink-0 text-foreground" aria-hidden />
	return null
}

function isReferenceResourcePanelItem(
	item: ReferenceResourcePanelItem | undefined,
): item is ReferenceResourcePanelItem {
	return Boolean(item)
}

interface ReferenceResourcePopoverProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onMouseEnter: () => void
	onMouseLeave: () => void
	trigger: ReactNode
	/** 不传时使用内置「本地上传 / 项目选择」文案与默认禁用逻辑 */
	sourceOptions?: ReferenceResourceSourceOption[]
	/** 仅素材可被当前业务消费时启用；其他入口保持原有两个来源。 */
	includeAssetsSource?: boolean
	onSelectSource: (source: ReferenceResourceSourceType) => void
	maxReferenceFiles?: number
	currentReferenceFiles?: string[]
	isReferenceFileLimitReached?: boolean
	referenceResourceType: ReferenceResourceTypeFilter
	referenceFileInfos: ReferenceResourceFileInfo[]
	assetLimits?: ReferenceAssetPerTypeLimits
	currentAssetCounts?: ReferenceAssetTypeCounts
	canAcceptNextAsset?: (
		fileClass: ReferenceAssetFileClass,
		currentAssetCounts: ReferenceAssetTypeCounts,
	) => boolean
	onProjectSelect?: (
		item: ReferenceResourcePanelItem,
		context?: ReferenceResourcePanelSelectContext,
	) => void
	/** 在本地上传/项目选择入口之前渲染的业务自定义内容。 */
	beforeSourceActions?: ReactNode
	hoverContent?: ReactNode
	clickContent?: ReactNode
	triggerClassName?: string
	contentClassName?: string
	bodyClassName?: string
	sourceActionsClassName?: string
	sourceActionClassName?: string
	/** 项目文件选择面板（ReferenceResourcePanel）展开/收起时通知宿主，用于保持外层布局（如 SourceList keepOpen） */
	onProjectSelectPanelOpenChange?: (visible: boolean) => void
	/** 当前入口一次项目多选最多提交多少项；如单 slot 替换场景传 1 */
	maxProjectSelectBatchCount?: number
	/** 是否允许项目文件面板多选；默认 true。替换场景应关闭。 */
	enableProjectSelectMultiSelect?: boolean
}

export default function ReferenceResourcePopover(props: ReferenceResourcePopoverProps) {
	const {
		open,
		onOpenChange,
		onMouseEnter,
		onMouseLeave,
		trigger,
		sourceOptions: sourceOptionsProp,
		includeAssetsSource = false,
		onSelectSource,
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		referenceResourceType,
		referenceFileInfos,
		assetLimits,
		currentAssetCounts,
		canAcceptNextAsset,
		onProjectSelect,
		beforeSourceActions,
		hoverContent,
		clickContent,
		triggerClassName,
		contentClassName,
		bodyClassName,
		sourceActionsClassName,
		sourceActionClassName,
		onProjectSelectPanelOpenChange,
		maxProjectSelectBatchCount,
		enableProjectSelectMultiSelect = true,
	} = props
	const { t } = useCanvasDesignI18n()
	const { referenceResourcePanelRenderer: ReferenceResourcePanelRenderer, methods } = useMagic()
	const [displayMode, setDisplayMode] = useState<"hover" | "click">("click")
	const [isProjectSelectVisible, setIsProjectSelectVisible] = useState(false)
	const internalTriggerRef = useRef<HTMLDivElement>(null)
	/** Radix Trigger 在已打开时再次点击会 onOpenChange(false)；hover 态下应转为 click 态并保持打开 */
	const suppressNextTriggerCloseRef = useRef(false)
	/** 点击「从项目选择」时 Radix 会在 onClick 前派发关闭；capture 阶段置位以维持外层 Popover 打开 */
	const suppressNextContentDismissRef = useRef(false)
	/** touch/pen pointerdown 已主动打开，后续合成 click 不应再交给 Radix trigger toggle */
	const suppressNextTouchTriggerClickRef = useRef(false)
	/** 用户已在 trigger 上 pointerdown 进入「本地上传/项目选择」态；此时不应因浮层 mouseenter 退回 hover 列表 */
	const userChoseClickModeRef = useRef(false)
	const projectSelectBatchItemsRef = useRef<Array<ReferenceResourcePanelItem | undefined>>([])

	useEffect(() => {
		if (!open) {
			suppressNextTriggerCloseRef.current = false
			suppressNextContentDismissRef.current = false
			suppressNextTouchTriggerClickRef.current = false
			userChoseClickModeRef.current = false
			projectSelectBatchItemsRef.current = []
			setIsProjectSelectVisible(false)
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

	const projectSelectRuntime = useCanvasReferenceMentionRuntime({
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		referenceResourceType,
		referenceFileInfos,
		assetLimits,
		currentAssetCounts,
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
			...(includeAssetsSource
				? [
						{
							value: REFERENCE_RESOURCE_SOURCE_TYPES.assets,
							label: t("referenceAssets.assets", "素材库"),
							disabled: Boolean(isReferenceFileLimitReached),
						},
					]
				: []),
		]
	}, [includeAssetsSource, isReferenceFileLimitReached, t])

	const sourceOptions = sourceOptionsProp ?? defaultSourceOptions
	const shouldRenderSourceActions = displayMode === "click" && sourceOptions.length > 0

	const handleProjectSelectClose = useCallback(() => {
		projectSelectBatchItemsRef.current = []
		setIsProjectSelectVisible(false)
		onOpenChange(false)
	}, [onOpenChange])

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
			if (
				rt instanceof Element &&
				rt.closest("[data-mention-panel], [data-linked-frame-submenu]")
			)
				return
			onMouseLeave()
		},
		[isProjectSelectVisible, onMouseLeave],
	)

	const handleReferencePopoverInteractOutside = useCallback((event: Event) => {
		const target = event.target
		if (
			target instanceof Element &&
			target.closest(
				"[data-mention-panel], [data-linked-frame-submenu], [data-linked-frame-submenu-trigger]",
			)
		) {
			event.preventDefault()
		}
	}, [])

	const handleProjectSelectPointerDownCapture = useCallback(() => {
		suppressNextContentDismissRef.current = true
	}, [])

	const handleTriggerPointerDown = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (!hoverContent) return

			if (event.pointerType === "touch" || event.pointerType === "pen") {
				userChoseClickModeRef.current = true
				setDisplayMode("click")
				if (!open) {
					suppressNextTouchTriggerClickRef.current = true
					onOpenChange(true)
					return
				}
				if (displayMode === "hover") {
					suppressNextTriggerCloseRef.current = true
				}
				return
			}

			if (!open) return
			if (displayMode !== "hover") return
			suppressNextTriggerCloseRef.current = true
			userChoseClickModeRef.current = true
			setDisplayMode("click")
		},
		[displayMode, hoverContent, onOpenChange, open],
	)

	const handleTriggerClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
		if (!suppressNextTouchTriggerClickRef.current) return
		suppressNextTouchTriggerClickRef.current = false
		event.preventDefault()
		event.stopPropagation()
	}, [])

	const handleSourceSelect = useCallback(
		(source: ReferenceResourceSourceType) => {
			onSelectSource(source)
			if (source !== REFERENCE_RESOURCE_SOURCE_TYPES.projectSelect) return
			if (!ReferenceResourcePanelRenderer || !projectSelectRuntime.dataService) {
				suppressNextContentDismissRef.current = false
				return
			}
			setIsProjectSelectVisible(true)
		},
		[ReferenceResourcePanelRenderer, onSelectSource, projectSelectRuntime.dataService],
	)

	const handleProjectSelect = useCallback(
		(item: ReferenceResourcePanelItem, context?: ReferenceResourcePanelSelectContext) => {
			if (!context?.batch) {
				onProjectSelect?.(item, context)
				if (context?.reset) {
					handleProjectSelectClose()
				}
				return
			}

			const { index, total } = context.batch
			projectSelectBatchItemsRef.current[index] = item
			if (index < total - 1) return

			const batchItems = projectSelectBatchItemsRef.current
				.slice(0, total)
				.filter(isReferenceResourcePanelItem)
			projectSelectBatchItemsRef.current = []
			const selectedItems = filterReferenceResourcePanelBatchItems({
				items: batchItems,
				maxReferenceFiles,
				currentReferenceFiles,
				assetLimits,
				currentAssetCounts,
				canAcceptNextAsset,
				maxBatchItems: maxProjectSelectBatchCount,
				resolveResourceReference: methods?.resolveResourceReference,
			})

			let didReset = false
			const resetOnce = () => {
				if (didReset) return
				didReset = true
				context.reset?.()
			}

			selectedItems.forEach((selectedItem, selectedIndex) => {
				const isLastSelected = selectedIndex === selectedItems.length - 1
				onProjectSelect?.(selectedItem, {
					batch: {
						index: selectedIndex,
						total: selectedItems.length,
					},
					...(isLastSelected && context.reset ? { reset: resetOnce } : undefined),
				})
			})

			resetOnce()
			handleProjectSelectClose()
		},
		[
			assetLimits,
			currentAssetCounts,
			canAcceptNextAsset,
			currentReferenceFiles,
			handleProjectSelectClose,
			maxProjectSelectBatchCount,
			maxReferenceFiles,
			methods?.resolveResourceReference,
			onProjectSelect,
		],
	)

	return (
		<>
			<Popover open={open} onOpenChange={handleRootOpenChange}>
				<PopoverTrigger asChild>
					<div
						ref={internalTriggerRef}
						className={triggerClassName}
						onMouseEnter={() => {
							if (hoverContent && !userChoseClickModeRef.current) {
								setDisplayMode("hover")
								onMouseEnter()
							}
						}}
						onMouseLeave={hoverContent ? handlePopoverHostMouseLeave : undefined}
						onPointerDown={handleTriggerPointerDown}
						onClickCapture={handleTriggerClickCapture}
					>
						{trigger}
					</div>
				</PopoverTrigger>
				{!isProjectSelectVisible && (
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
							{beforeSourceActions}
							{shouldRenderSourceActions && (
								<div
									className={cn(
										"flex w-full flex-col gap-0",
										sourceActionsClassName,
									)}
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
				)}
			</Popover>
			{ReferenceResourcePanelRenderer && projectSelectRuntime.dataService && (
				<ReferenceResourcePanelRenderer
					visible={isProjectSelectVisible}
					triggerRef={internalTriggerRef as React.RefObject<HTMLElement | null>}
					language="zh-CN"
					enableMultiSelect={enableProjectSelectMultiSelect}
					onSelect={handleProjectSelect}
					onClose={handleProjectSelectClose}
					dataService={projectSelectRuntime.dataService}
					selectionScopeId={projectSelectRuntime.selectionScopeId}
					selectionSummary={projectSelectRuntime.selectionSummary}
					initialLoadOptions={projectSelectRuntime.initialLoadOptions}
					initialNavigationStack={projectSelectRuntime.initialNavigationStack}
					catalogBehavior={projectSelectRuntime.catalogBehavior}
				/>
			)}
		</>
	)
}
