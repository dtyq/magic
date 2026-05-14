import { useEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { userStore } from "@/models/user"
import { ModelSwitchProps, type ModelListKey, type ModelTabType } from "./types"
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
import { cn } from "@/lib/utils"
import { modelSwitchVariants, ICON_SIZE_MAP, CHEVRON_SIZE_MAP } from "./constants"
import { useModelSwitchLogic } from "./hooks/useModelSwitchLogic"
import { ModelListContent } from "./components/ModelListContent"
import {
	ChevronsUpDownIcon,
	ChevronLeft,
	ChevronDownIcon,
	MessageSquareTextIcon,
	ImageIcon,
	ClapperboardIcon,
	Search,
	X,
} from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { MagicDropdown } from "@/components/base"
import { ModelEmptyState } from "./components/ModelEmptyState"
import { ModelSwitchTriggerContent } from "./components/ModelSwitchTriggerContent"
import { ModelTabSwitcher } from "./components/ModelTabSwitcher"

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
}: ModelSwitchProps) {
	const [activeTab, setActiveTab] = useState<ModelTabType>(defaultTab)
	const [tooltipOpen, setTooltipOpen] = useState(false)
	const [addMenuOpen, setAddMenuOpen] = useState(false)
	const dropdownJustClosedRef = useRef(false)
	const openAddMenuTimerRef = useRef<number | null>(null)
	// 将 t 保持在当前组件作用域内，便于 i18n Ally 正确识别默认命名空间 super。
	const { t } = useTranslation("super")

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
			if (activeTab === "image") {
				onImageModelChange?.(model)
			} else if (activeTab === "video") {
				onVideoModelChange?.(model)
			} else {
				onModelChange?.(model)
			}
		},
		onBeforeOpen,
	})

	const { isPersonalOrganization } = userStore.user
	const canManageModels = isPersonalOrganization

	const iconSize = ICON_SIZE_MAP[size]
	const chevronSize = CHEVRON_SIZE_MAP[size]

	// Check if image_models list is empty
	const hasImageModels =
		imageModelList &&
		imageModelList.length > 0 &&
		imageModelList.some((item) => (item.image_models ?? []).length > 0)
	const hasVideoModels =
		videoModelList &&
		videoModelList.length > 0 &&
		videoModelList.some((item) => (item.video_models ?? []).length > 0)

	// If activeTab points to an unsupported tab and cannot add models, switch back to "language"
	const canAddModel = editable && !!onAddModel && canManageModels
	useEffect(() => {
		const shouldFallbackToLanguage =
			(activeTab === "image" && !hasImageModels && !canAddModel) ||
			(activeTab === "video" && !hasVideoModels)
		if (shouldFallbackToLanguage) {
			setActiveTab("language")
		}
	}, [activeTab, hasImageModels, hasVideoModels, canAddModel])

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
		setActiveTab(defaultTab)
	}, [defaultTab, isOpen])

	const currentModelList =
		activeTab === "image"
			? imageModelList || []
			: activeTab === "video"
				? videoModelList || []
				: modelList
	const currentSelectedModel =
		activeTab === "image"
			? selectedImageModel || null
			: activeTab === "video"
				? selectedVideoModel || null
				: selectedModel
	const currentModelKey: ModelListKey =
		activeTab === "image" ? "image_models" : activeTab === "video" ? "video_models" : "models"

	const ADD_MODEL_DROPDOWN_CONTENT_CLASS = "model-switch-add-model-dropdown-content"

	// // Check if large language model list has any models (only block render when language tab has no models)
	// const hasLanguageModels =
	// 	modelList.length > 0 && modelList.some((item) => (item.models ?? []).length > 0)

	// if (!hasLanguageModels) {
	// 	return null
	// }

	const addModelMenu = editable && onAddModel && canManageModels && (
		<MagicDropdown
			open={addMenuOpen}
			onOpenChange={setAddMenuOpen}
			placement="bottomRight"
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
				</div>
			)}
		>
			<span onPointerEnter={onPreloadAddModel} onFocus={onPreloadAddModel}>
				<Button
					size="sm"
					className="h-8 gap-2 px-3 py-2 text-xs font-medium"
					data-testid="model-switch-add-model-trigger"
				>
					{t("messageEditor.addModel.addModel")}
					<ChevronDownIcon size={16} />
				</Button>
			</span>
		</MagicDropdown>
	)

	const popoverHeader = (
		<div className="flex items-center gap-2.5 px-4 pb-2.5 pt-4">
			<p className="min-w-0 flex-1 truncate text-lg font-semibold leading-7 text-foreground">
				{t("messageEditor.modelSwitch.headerTitle")}
			</p>
			{addModelMenu}
		</div>
	)

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

	const showImageTab = hasImageModels || canAddModel
	const showVideoTab = hasVideoModels
	const showTabSwitcher = showImageTab || showVideoTab
	const tabSwitcher = showTabSwitcher ? (
		<ModelTabSwitcher
			activeTab={activeTab}
			onTabChange={setActiveTab}
			showImageTab={showImageTab}
			showVideoTab={showVideoTab}
			isMobile={isMobile}
		/>
	) : null

	const isCurrentTabEmpty =
		(activeTab === "image" && !hasImageModels) || (activeTab === "video" && !hasVideoModels)
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
			selectedItemRef={selectedItemRef}
			getModelDescription={getModelDescription}
			modelKey={currentModelKey}
			onModelsLoaded={onBeforeOpen}
		/>
	)

	// Mobile render using MagicPopup
	if (isMobile) {
		return (
			<>
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
						/>
					)}
					<ChevronsUpDownIcon size={chevronSize} />
				</FlexBox>

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
				open={isOpen ? false : tooltipOpen}
				onOpenChange={(open) => {
					if (isOpen) {
						setTooltipOpen(false)
						return
					}
					// Prevent tooltip from opening immediately after dropdown closes
					if (dropdownJustClosedRef.current && open) {
						return
					}
					setTooltipOpen(open)
				}}
				delayDuration={200}
			>
				<DropdownMenu
					open={isOpen}
					onOpenChange={(open) => {
						if (open) {
							setTooltipOpen(false)
						} else {
							setAddMenuOpen(false)
							// Mark that dropdown just closed to prevent immediate tooltip
							dropdownJustClosedRef.current = true
							setTimeout(() => {
								dropdownJustClosedRef.current = false
							}, 500)
						}
						void handleOpenChange(open)
					}}
				>
					<TooltipTrigger asChild>
						<span className="inline-flex">
							<DropdownMenuTrigger asChild>
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
										/>
									)}
									<ChevronsUpDownIcon size={chevronSize} />
								</button>
							</DropdownMenuTrigger>
						</span>
					</TooltipTrigger>
					<DropdownMenuContent
						side={getSide()}
						align="start"
						className="z-dropdown w-[380px] overflow-visible p-0"
						sideOffset={4}
						onInteractOutside={(event) => {
							const target = event.target
							if (!(target instanceof HTMLElement)) return

							if (
								target.closest(`.${ADD_MODEL_DROPDOWN_CONTENT_CLASS}`) ||
								target.closest('[data-testid="model-switch-add-model-trigger"]')
							) {
								event.preventDefault()
							}
						}}
					>
						<div className="flex flex-col">
							{popoverHeader}
							{tabSwitcher}
							<div
								ref={desktopScrollContainerRef}
								className="scrollbar-y-thin flex max-h-[420px] flex-col gap-2.5 overflow-y-auto px-4 pr-2"
							>
								{mainContent}
							</div>
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
