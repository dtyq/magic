import { useEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { userStore } from "@/models/user"
import { ModelSwitchProps } from "./types"
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
import { ChevronsUpDownIcon, ChevronDownIcon, MessageSquareTextIcon, ImageIcon } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { MagicDropdown } from "@/components/base"
import { ModelEmptyState } from "./components/ModelEmptyState"
import { ModelSwitchTriggerContent } from "./components/ModelSwitchTriggerContent"
import { ModelTabSwitcher } from "./components/ModelTabSwitcher"

type ModelTabType = "language" | "image"

export const ModelSwitch = observer(function ModelSwitch({
	size = "default",
	selectedModel,
	isLoading = false,
	onModelChange,
	selectedImageModel,
	imageModelList,
	onImageModelChange,
	showName = true,
	showBorder = false,
	className,
	modelList,
	placement,
	showLabel = true,
	openAddModelMenuSignal = 0,
	editable = true,
	onAddModel,
	onBeforeOpen,
}: ModelSwitchProps) {
	const [activeTab, setActiveTab] = useState<ModelTabType>("language")
	const [tooltipOpen, setTooltipOpen] = useState(false)
	const [addMenuOpen, setAddMenuOpen] = useState(false)
	const dropdownJustClosedRef = useRef(false)
	const openAddMenuTimerRef = useRef<number | null>(null)

	const {
		isOpen,
		searchKeyword,
		isMobile,
		t,
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

	// If activeTab is "image" but no image models and cannot add models, switch back to "language"
	const canAddModel = editable && !!onAddModel && canManageModels
	useEffect(() => {
		if (activeTab === "image" && !hasImageModels && !canAddModel) {
			setActiveTab("language")
		}
	}, [activeTab, hasImageModels, canAddModel])

	useEffect(() => {
		if (!openAddModelMenuSignal || isMobile || !canAddModel) return

		setTooltipOpen(false)
		void handleOpenChange(true)

		if (openAddMenuTimerRef.current) {
			window.clearTimeout(openAddMenuTimerRef.current)
		}

		openAddMenuTimerRef.current = window.setTimeout(() => {
			setAddMenuOpen(true)
		}, 80)
	}, [openAddModelMenuSignal, isMobile, canAddModel, handleOpenChange])

	useEffect(() => {
		return () => {
			if (openAddMenuTimerRef.current) {
				window.clearTimeout(openAddMenuTimerRef.current)
			}
		}
	}, [])

	const currentModelList = activeTab === "language" ? modelList : imageModelList || []
	const currentSelectedModel =
		activeTab === "language" ? selectedModel : selectedImageModel || null

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
							onAddModel("text")
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
							onAddModel("image")
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
			<span>
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
				{t("messageEditor.modelSwitch.models")}
			</p>
			{addModelMenu}
		</div>
	)

	const showTabSwitcher = hasImageModels || canAddModel
	const tabSwitcher = showTabSwitcher ? (
		<ModelTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
	) : null

	const isImageTabEmpty = activeTab === "image" && !hasImageModels

	const mainContent = isImageTabEmpty ? (
		<ModelEmptyState
			icon={ImageIcon}
			title={t("messageEditor.modelSwitch.noImageModels")}
			description={t("messageEditor.modelSwitch.noImageModelsDesc")}
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
			modelKey={activeTab === "image" ? "image_models" : "models"}
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
						className,
					)}
					onClick={() => void handleOpenChange(true)}
					data-testid="super-message-editor-model-switch-mobile"
				>
					{showName && (
						<ModelSwitchTriggerContent
							showLabel={showLabel}
							selectedLanguageModel={selectedModel}
							selectedImageModel={selectedImageModel}
							isLoading={isLoading}
							iconSize={iconSize}
						/>
					)}
					<ChevronsUpDownIcon size={chevronSize} />
				</FlexBox>

				<MagicPopup
					visible={isOpen}
					onClose={handleClose}
					bodyClassName="rounded-t-xl p-0 bg-card"
				>
					<div className="flex w-full flex-col bg-card">
						<div className="border-b border-border">{popoverHeader}</div>
						<div className="pt-2.5">{tabSwitcher}</div>
						<div
							ref={mobileScrollContainerRef}
							className="scrollbar-y-thin flex max-h-[60vh] flex-col overflow-y-auto rounded-lg p-3"
						>
							{mainContent}
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
										"inline-flex items-center justify-center gap-2 border-0 bg-transparent p-0",
										"outline-none",
										modelSwitchVariants({ size, variant: "secondary" }),
										showBorder && "border border-border",
										size === "small" && "max-w-[150px]",
										className,
									)}
									data-testid="super-message-editor-model-switch"
									data-model-id={selectedModel?.model_id}
									data-model-name={selectedModel?.model_name}
								>
									{showName && (
										<ModelSwitchTriggerContent
											showLabel={showLabel}
											selectedLanguageModel={selectedModel}
											selectedImageModel={selectedImageModel}
											isLoading={isLoading}
											iconSize={iconSize}
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
					/>
				</TooltipContent>
			</TooltipPrimitive.Root>
		</TooltipProvider>
	)
})

export default ModelSwitch
