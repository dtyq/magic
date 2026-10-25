import { useEffect, useRef, useState } from "react"
import { Slot } from "@radix-ui/react-slot"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { userStore } from "@/models/user"
import { ModelSwitchProps, type ModelItem, type ModelListKey, type ModelTabType } from "./types"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import FlexBox from "@/components/base/FlexBox"
import { TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/shadcn-ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
} from "@/components/shadcn-ui/dropdown-menu"
import { ModelPreferenceTooltip } from "./components/ModelPreferenceTooltip"
import { cn } from "@/utils/cn"
import { modelSwitchVariants, ICON_SIZE_MAP, CHEVRON_SIZE_MAP } from "./constants"
import { useModelSwitchLogic } from "./hooks/useModelSwitchLogic"
import { useModelSwitchConfirmation } from "./hooks/useModelSwitchConfirmation"
import { ModelListContent } from "./components/ModelListContent"
import { ModelInfoHoverProvider } from "./components/ModelInfoHoverCard"
import {
	ModelReasoningFooter,
	resolveReasoningFooterModel,
} from "./components/ModelReasoningFooter"
import {
	ChevronsUpDownIcon,
	ChevronLeft,
	ChevronDownIcon,
	MessageSquareTextIcon,
	ImageIcon,
	ClapperboardIcon,
	PlusIcon,
	Search,
	X,
} from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { MagicDropdown } from "@/components/base"
import { ModelEmptyState } from "./components/ModelEmptyState"
import { ModelSwitchTriggerContent } from "./components/ModelSwitchTriggerContent"
import { ModelTabSwitcher } from "./components/ModelTabSwitcher"
import { resolveShowSelectedModelName } from "./utils"
import { useOptionalAddModelStore } from "./components/AddModel/context"

export const ModelSwitch = observer(function ModelSwitch({
	size = "default",
	selectedModel,
	isLoading = false,
	onModelChange,
	selectedImageModel,
	imageModelList,
	onImageModelChange,
	selectedVideoModel,
	videoModelList,
	onVideoModelChange,
	showName = true,
	showSelectedModelName = false,
	showBorder = false,
	className,
	modelList,
	placement,
	showLabel = true,
	openAddModelMenuSignal = 0,
	editable = true,
	onAddModel,
	onPreloadAddModel,
	onBeforeOpen,
	defaultTab = "language",
	triggerTab,
	triggerTestId,
	trigger,
	selection,
	allowedTabs,
}: ModelSwitchProps) {
	const confirmation = useModelSwitchConfirmation(selection)
	const { setPendingModel } = confirmation
	const needsConfirmation = selection?.mode === "confirm"
	const allowedDefaultTab =
		!allowedTabs || allowedTabs.includes(defaultTab) ? defaultTab : allowedTabs[0]
	const [activeTab, setActiveTab] = useState<ModelTabType>(allowedDefaultTab)
	const [tooltipOpen, setTooltipOpen] = useState(false)
	const [addMenuOpen, setAddMenuOpen] = useState(false)
	// Keep the tooltip suppressed for the current pointer-hover cycle after the model menu closes.
	// Selecting a model closes the dropdown while the pointer can still be over the trigger, so
	// Radix's pending hover timer must wait until the pointer leaves before it can open again.
	const tooltipSuppressedRef = useRef(false)
	const openAddMenuTimerRef = useRef<number | null>(null)
	// 将 t 保持在当前组件作用域内，便于 i18n Ally 正确识别默认命名空间 super。
	const { t } = useTranslation("super")
	const addModelStore = useOptionalAddModelStore()
	const handleModelChange = (model: ModelItem) => {
		if (activeTab === "image") {
			onImageModelChange?.(model)
		} else if (activeTab === "video") {
			onVideoModelChange?.(model)
		} else {
			onModelChange?.(model)
		}
	}

	const {
		isOpen,
		searchKeyword,
		setSearchKeyword,
		isMobile,
		selectedItemRef,
		desktopScrollContainerRef,
		mobileScrollContainerRef,
		handleModelClick: baseHandleModelClick,
		handleClose,
		handleOpenChange,
		getModelDescription,
	} = useModelSwitchLogic({
		onModelClick: (model) => {
			if (selection?.mode === "confirm") {
				if (!confirmation.submitting && !selection.getModelState?.(model)?.disabled)
					confirmation.setPendingModel(model)
				return
			}
			if (activeTab === "image") {
				onImageModelChange?.(model)
			} else if (activeTab === "video") {
				onVideoModelChange?.(model)
			} else {
				onModelChange?.(model)
			}
		},
		onBeforeOpen: async () => {
			await onBeforeOpen?.()
			if (needsConfirmation)
				confirmation.setPendingModel(
					allowedDefaultTab === "image"
						? (selectedImageModel ?? null)
						: allowedDefaultTab === "video"
							? (selectedVideoModel ?? null)
							: (selectedModel ?? null),
				)
		},
		shouldCloseOnSelect: needsConfirmation ? false : undefined,
	})
	const previousIsOpenRef = useRef(isOpen)

	useEffect(() => {
		if (previousIsOpenRef.current !== isOpen) {
			tooltipSuppressedRef.current = true
			setTooltipOpen(false)
		}
		previousIsOpenRef.current = isOpen
	}, [isOpen])

	useEffect(() => {
		if (!isOpen) setPendingModel(null)
	}, [isOpen, setPendingModel])

	const { isPersonalOrganization } = userStore.user
	const canManageModels = isPersonalOrganization && !needsConfirmation

	const iconSize = ICON_SIZE_MAP[size]
	const chevronSize = CHEVRON_SIZE_MAP[size]

	const hasOfficialImageModels =
		imageModelList &&
		imageModelList.length > 0 &&
		imageModelList.some((item) => (item.image_models ?? []).length > 0)
	const hasOfficialVideoModels =
		videoModelList &&
		videoModelList.length > 0 &&
		videoModelList.some((item) => (item.video_models ?? []).length > 0)
	const hasCustomImageModels =
		// 与 MyModelsList 一致按 category 判断：vlm=生图、vgm=视频。
		addModelStore?.myModels.some((model) => model.category === "vlm") ?? false
	const hasCustomVideoModels =
		addModelStore?.myModels.some((model) => model.category === "vgm") ?? false
	const isLoadingCustomModels =
		(addModelStore?.isLoadingMyModels ?? false) ||
		(isOpen && addModelStore != null && !addModelStore.hasLoadedMyModels)

	useEffect(() => {
		if (!isOpen || !addModelStore) return
		void addModelStore.loadMyModels(false)
	}, [addModelStore, isOpen])

	const hasAnyImageModels = hasOfficialImageModels || hasCustomImageModels
	const hasAnyVideoModels = hasOfficialVideoModels || hasCustomVideoModels

	// If activeTab points to an unsupported tab and cannot add models, switch back to "language"
	const canAddModel = editable && !!onAddModel && canManageModels
	useEffect(() => {
		const shouldFallbackToLanguage =
			((activeTab === "image" && !hasAnyImageModels) ||
				(activeTab === "video" && !hasAnyVideoModels)) &&
			!isLoadingCustomModels &&
			!canAddModel &&
			(!allowedTabs || allowedTabs.includes("language"))
		if (shouldFallbackToLanguage) {
			setActiveTab("language")
		}
	}, [
		activeTab,
		hasAnyImageModels,
		hasAnyVideoModels,
		isLoadingCustomModels,
		canAddModel,
		allowedTabs,
	])

	useEffect(() => {
		if (!openAddModelMenuSignal || isMobile || !canAddModel) return

		onPreloadAddModel?.()
		setTooltipOpen(false)
		void handleOpenChange(true)

		if (openAddMenuTimerRef.current) {
			window.clearTimeout(openAddMenuTimerRef.current)
		}

		openAddMenuTimerRef.current = window.setTimeout(() => {
			setAddMenuOpen(true)
		}, 80)
	}, [openAddModelMenuSignal, isMobile, canAddModel, handleOpenChange, onPreloadAddModel])

	useEffect(() => {
		return () => {
			if (openAddMenuTimerRef.current) {
				window.clearTimeout(openAddMenuTimerRef.current)
			}
		}
	}, [])

	useEffect(() => {
		if (!isOpen) return
		setActiveTab(allowedDefaultTab)
	}, [allowedDefaultTab, isOpen])

	const currentModelList =
		activeTab === "image"
			? imageModelList || []
			: activeTab === "video"
				? videoModelList || []
				: modelList
	const currentSelectedModel = needsConfirmation
		? confirmation.pendingModel
		: activeTab === "image"
			? selectedImageModel || null
			: activeTab === "video"
				? selectedVideoModel || null
				: selectedModel
	const currentModelKey: ModelListKey =
		activeTab === "image" ? "image_models" : activeTab === "video" ? "video_models" : "models"
	const reasoningFooterModel = resolveReasoningFooterModel({
		activeTab,
		selectedModel,
		groups: modelList,
	})

	const ADD_MODEL_DROPDOWN_CONTENT_CLASS = "model-switch-add-model-dropdown-content"

	// // Check if large language model list has any models (only block render when language tab has no models)
	// const hasLanguageModels =
	// 	modelList.length > 0 && modelList.some((item) => (item.models ?? []).length > 0)

	// if (!hasLanguageModels) {
	// 	return null
	// }

	// header：移动端弹层标题栏右侧的主按钮；row：桌面面板底部的整行入口。
	const renderAddModelMenu = (variant: "header" | "row") =>
		editable &&
		onAddModel &&
		canManageModels && (
			<MagicDropdown
				open={addMenuOpen}
				onOpenChange={setAddMenuOpen}
				placement={variant === "row" ? "topLeft" : "bottomRight"}
				overlayClassName={ADD_MODEL_DROPDOWN_CONTENT_CLASS}
				popupRender={() => (
					<div className="w-40">
						<div className="px-2 py-1.5">
							<span className="text-xs font-normal leading-4 text-muted-foreground">
								{t("messageEditor.addModel.addModel")}
							</span>
						</div>
						<button
							className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm font-normal leading-none text-foreground hover:bg-accent"
							onClick={() => {
								void onAddModel("text")
								setAddMenuOpen(false)
							}}
							data-testid="add-model-type-text"
						>
							<MessageSquareTextIcon size={16} />
							{t("messageEditor.addModel.typeText")}
						</button>
						<button
							className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm font-normal leading-none text-foreground hover:bg-accent"
							onClick={() => {
								void onAddModel("image")
								setAddMenuOpen(false)
							}}
							data-testid="add-model-type-image"
						>
							<ImageIcon size={16} />
							{t("messageEditor.addModel.typeImage")}
						</button>
						<button
							className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm font-normal leading-none text-foreground hover:bg-accent"
							onClick={() => {
								void onAddModel("video")
								setAddMenuOpen(false)
							}}
							data-testid="add-model-type-video"
						>
							<ClapperboardIcon size={16} />
							{t("messageEditor.addModel.typeVideo")}
						</button>
					</div>
				)}
			>
				<span
					className={variant === "row" ? "block" : undefined}
					onPointerEnter={onPreloadAddModel}
					onFocus={onPreloadAddModel}
				>
					{variant === "row" ? (
						<Button
							variant="ghost"
							className="h-9 w-full justify-start gap-2 px-2 text-sm font-normal text-foreground"
							data-testid="model-switch-add-model-trigger"
						>
							<PlusIcon size={16} className="text-muted-foreground" />
							{t("messageEditor.addModel.addModel")}
						</Button>
					) : (
						<Button
							size="sm"
							className="h-8 gap-2 px-3 py-2 text-xs font-medium"
							data-testid="model-switch-add-model-trigger"
						>
							{t("messageEditor.addModel.addModel")}
							<ChevronDownIcon size={16} />
						</Button>
					)}
				</span>
			</MagicDropdown>
		)
	const addModelMenu = renderAddModelMenu("header")
	const addModelRow = renderAddModelMenu("row")

	const mobilePopoverHeader = (
		<div className="relative flex h-14 w-full shrink-0 items-center justify-center px-16 py-2">
			<button
				type="button"
				onClick={handleClose}
				className="absolute left-[10px] top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
				aria-label={t("common.back", { defaultValue: "Back" })}
				data-testid="model-switch-mobile-header-back-button"
			>
				<ChevronLeft className="size-[22px] text-foreground" />
			</button>
			<p className="max-w-[247px] truncate text-center text-[18px] font-medium leading-6 text-foreground">
				{t("messageEditor.modelSwitch.headerTitle")}
			</p>
			{addModelMenu ? (
				<div className="absolute right-4 top-1/2 -translate-y-1/2">{addModelMenu}</div>
			) : null}
		</div>
	)

	const showImageTab =
		(hasAnyImageModels || canAddModel) && (!allowedTabs || allowedTabs.includes("image"))
	const showVideoTab =
		(hasAnyVideoModels || canAddModel) && (!allowedTabs || allowedTabs.includes("video"))
	const showLanguageTab = !allowedTabs || allowedTabs.includes("language")
	const showTabSwitcher =
		Number(showLanguageTab) + Number(showImageTab) + Number(showVideoTab) > 1
	const resolvedShowSelectedModelName = resolveShowSelectedModelName({
		showSelectedModelName,
		showImageTab,
		showVideoTab,
	})
	const tabSwitcher = showTabSwitcher ? (
		<ModelTabSwitcher
			activeTab={activeTab}
			onTabChange={setActiveTab}
			showImageTab={showImageTab}
			showLanguageTab={showLanguageTab}
			showVideoTab={showVideoTab}
			isMobile={isMobile}
		/>
	) : null

	const isCurrentTabEmpty =
		((activeTab === "image" && !hasAnyImageModels) ||
			(activeTab === "video" && !hasAnyVideoModels)) &&
		!isLoadingCustomModels
	const currentEmptyState =
		activeTab === "video"
			? {
					icon: ClapperboardIcon,
					title: t("messageEditor.modelSwitch.noVideoModels"),
					description: t("messageEditor.modelSwitch.noVideoModelsDesc"),
				}
			: {
					icon: ImageIcon,
					title: t("messageEditor.modelSwitch.noImageModels"),
					description: t("messageEditor.modelSwitch.noImageModelsDesc"),
				}

	const mainContent = isCurrentTabEmpty ? (
		<ModelEmptyState
			icon={currentEmptyState.icon}
			title={currentEmptyState.title}
			description={currentEmptyState.description}
			className="min-h-0 border-0 bg-transparent py-8"
		/>
	) : (
		<ModelListContent
			modelList={currentModelList}
			selectedModel={currentSelectedModel || null}
			searchKeyword={searchKeyword}
			size={size}
			onModelClick={baseHandleModelClick}
			onReasoningEffortChange={needsConfirmation ? baseHandleModelClick : handleModelChange}
			selectedItemRef={selectedItemRef}
			getModelDescription={getModelDescription}
			getModelState={selection?.mode === "confirm" ? selection.getModelState : undefined}
			modelKey={currentModelKey}
			onModelsLoaded={onBeforeOpen}
			showModelInfo={!isMobile}
			allowModelManagement={!needsConfirmation}
		/>
	)

	const confirmationFooter = selection?.mode === "confirm" && (
		<div className="shrink-0 space-y-3 border-t px-4 py-3">
			{selection.description && (
				<div className="text-xs leading-5 text-muted-foreground">
					{selection.description}
				</div>
			)}
			<div className="flex justify-end gap-2">
				<Button variant="ghost" size="sm" onClick={handleClose}>
					{t("common.cancel")}
				</Button>
				<Button
					size="sm"
					disabled={confirmation.submitting || !confirmation.canConfirm}
					onClick={() => void confirmation.confirm(handleClose)}
				>
					{confirmation.submitting
						? t("modelRecovery.submitting")
						: selection.confirmText}
				</Button>
			</div>
		</div>
	)

	// Mobile render using MagicPopup
	if (isMobile) {
		return (
			<>
				{trigger ? (
					<Slot onClick={() => void handleOpenChange(true)}>{trigger}</Slot>
				) : (
					<FlexBox
						gap={showName ? 4 : 2}
						align="center"
						className={cn(
							modelSwitchVariants({ size, variant: "secondary" }),
							showBorder && "border border-border",
							"shrink-0",
							className,
						)}
						onClick={() => void handleOpenChange(true)}
						data-testid={triggerTestId ?? "super-message-editor-model-switch-mobile"}
					>
						{showName && (
							<ModelSwitchTriggerContent
								showLabel={showLabel}
								selectedLanguageModel={selectedModel}
								selectedImageModel={selectedImageModel}
								selectedVideoModel={selectedVideoModel}
								isLoading={isLoading}
								iconSize={iconSize}
								triggerTab={triggerTab}
								showSelectedModelName={resolvedShowSelectedModelName}
							/>
						)}
						<ChevronsUpDownIcon size={chevronSize} />
					</FlexBox>
				)}

				<MagicPopup
					visible={isOpen}
					onClose={handleClose}
					bodyClassName="rounded-t-xl p-0 bg-card overflow-hidden"
				>
					<div className="flex h-[min(640px,calc(100vh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom)-44px))] min-h-0 w-full flex-col overflow-hidden bg-card">
						{mobilePopoverHeader}
						<div className="shrink-0 pt-2.5">{tabSwitcher}</div>
						<div
							ref={mobileScrollContainerRef}
							data-model-switch-scroll-container
							className="scrollbar-y-thin flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto rounded-lg p-3"
						>
							{mainContent}
						</div>
						<div className="shrink-0 px-2.5 pb-safe-bottom pt-2">
							<div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 shadow-xs">
								<Search className="h-4 w-4 shrink-0 text-muted-foreground" />
								<input
									type="search"
									value={searchKeyword}
									onChange={(event) => setSearchKeyword(event.target.value)}
									placeholder={t("messageEditor.modelSwitch.searchPlaceholder")}
									className="min-h-0 flex-1 border-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
									autoComplete="off"
									autoCorrect="off"
									autoCapitalize="off"
									spellCheck={false}
									enterKeyHint="search"
									data-testid="mobile-model-switch-search-input"
								/>
								{searchKeyword ? (
									<button
										type="button"
										onClick={() => setSearchKeyword("")}
										className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground text-background transition active:opacity-80"
										aria-label={t("common.cancel")}
										data-testid="mobile-model-switch-search-clear-button"
									>
										<X className="h-3 w-3" />
									</button>
								) : null}
							</div>
						</div>
						{confirmationFooter}
					</div>
				</MagicPopup>
			</>
		)
	}

	// Desktop render using DropdownMenu
	// Convert antd placement to radix side
	const getSide = (): "top" | "right" | "bottom" | "left" => {
		if (!placement) return "bottom"
		if (placement.startsWith("top")) return "top"
		if (placement.startsWith("bottom")) return "bottom"
		if (placement.startsWith("left")) return "left"
		if (placement.startsWith("right")) return "right"
		return "bottom"
	}

	return (
		<TooltipProvider delayDuration={200}>
			<TooltipPrimitive.Root
				open={isOpen || trigger ? false : tooltipOpen}
				onOpenChange={(open) => {
					if (isOpen || (open && tooltipSuppressedRef.current)) {
						setTooltipOpen(false)
						return
					}
					setTooltipOpen(open)
				}}
				delayDuration={200}
			>
				<DropdownMenu
					open={isOpen}
					onOpenChange={(open) => {
						tooltipSuppressedRef.current = true
						setTooltipOpen(false)
						if (!open) {
							setAddMenuOpen(false)
						}
						void handleOpenChange(open)
					}}
				>
					<TooltipTrigger asChild>
						<span
							className="inline-flex"
							onPointerEnter={() => {
								// A new pointer entry after the menu has closed starts a fresh tooltip cycle.
								if (!isOpen) tooltipSuppressedRef.current = false
							}}
							onPointerLeave={() => {
								tooltipSuppressedRef.current = false
							}}
						>
							<DropdownMenuTrigger asChild>
								{trigger ?? (
									<button
										type="button"
										className={cn(
											"inline-flex shrink-0 items-center justify-center gap-2 border-0 bg-transparent p-0",
											"outline-none",
											modelSwitchVariants({ size, variant: "secondary" }),
											showBorder && "border border-border",
											className,
										)}
										data-testid={
											triggerTestId ?? "super-message-editor-model-switch"
										}
										data-model-id={selectedModel?.model_id}
										data-model-name={selectedModel?.model_name}
									>
										{showName && (
											<ModelSwitchTriggerContent
												showLabel={showLabel}
												selectedLanguageModel={selectedModel}
												selectedImageModel={selectedImageModel}
												selectedVideoModel={selectedVideoModel}
												isLoading={isLoading}
												iconSize={iconSize}
												triggerTab={triggerTab}
												showSelectedModelName={
													resolvedShowSelectedModelName
												}
											/>
										)}
										<ChevronsUpDownIcon size={chevronSize} />
									</button>
								)}
							</DropdownMenuTrigger>
						</span>
					</TooltipTrigger>
					<DropdownMenuContent
						side={getSide()}
						align="start"
						className="z-dropdown max-h-[min(90dvh,var(--radix-dropdown-menu-content-available-height))] w-80 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border-border/80 bg-card p-0 shadow-lg"
						sideOffset={4}
						collisionPadding={12}
						onFocusOutside={(event) => {
							const target = event.target
							if (
								target instanceof Element &&
								target.closest("[data-model-switch-details-overlay]")
							) {
								event.preventDefault()
							}
						}}
						onInteractOutside={(event) => {
							const target = event.target
							if (!(target instanceof Element)) return
							// Detail and reasoning menus are Portals; interacting with them must not dismiss the model list.
							if (target.closest("[data-model-switch-details-overlay]")) {
								event.preventDefault()
								return
							}

							if (
								target.closest(`.${ADD_MODEL_DROPDOWN_CONTENT_CLASS}`) ||
								target.closest('[data-testid="model-switch-add-model-trigger"]')
							) {
								event.preventDefault()
							}
						}}
					>
						<div className="flex flex-col">
							{/* 桌面头部只有 Tab 分段器；触发按钮已经写明在选模型，不再放大标题。 */}
							{tabSwitcher}
							<div
								ref={desktopScrollContainerRef}
								data-model-switch-scroll-container
								className={cn(
									// 左右内边距对称，并为滚动条预留固定位置，选中行不会贴着滚动条。
									"scrollbar-y-thin flex max-h-[min(360px,calc(var(--radix-dropdown-menu-content-available-height)-9rem))] min-h-0 flex-col gap-0.5 overflow-y-auto px-2 pb-1.5 [scrollbar-gutter:stable]",
									!tabSwitcher && "pt-1.5",
								)}
							>
								{/* 整个列表共用一张悬停信息卡，滚动时收起。 */}
								<ModelInfoHoverProvider
									scrollContainerRef={desktopScrollContainerRef}
								>
									{mainContent}
								</ModelInfoHoverProvider>
							</div>
							{/* 思考强度与添加模型固定在列表下方，不盖住滚动区。 */}
							{reasoningFooterModel ? (
								<ModelReasoningFooter
									model={reasoningFooterModel}
									onReasoningEffortChange={
										needsConfirmation ? baseHandleModelClick : handleModelChange
									}
								/>
							) : null}
							{addModelRow ? (
								<div className="shrink-0 border-t border-border/70 px-1.5 py-1">
									{addModelRow}
								</div>
							) : null}
							{confirmationFooter}
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
				<TooltipContent
					className="max-w-[500px] bg-transparent p-0"
					side="top"
					align="start"
					sideOffset={8}
					onPointerDownOutside={(e) => e.preventDefault()}
				>
					<ModelPreferenceTooltip
						selectedLanguageModel={selectedModel || null}
						selectedImageModel={selectedImageModel || null}
						selectedVideoModel={selectedVideoModel || null}
					/>
				</TooltipContent>
			</TooltipPrimitive.Root>
		</TooltipProvider>
	)
})

export default ModelSwitch
