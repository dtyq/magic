import React, { memo, useEffect, useMemo, useState } from "react"
import { ModelSwitchProps, ModelItem } from "./types"
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
} from "@/components/shadcn-ui/dropdown-menu"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import FlexBox from "@/components/base/FlexBox"
import ModelIcon from "./components/ModelIcon"
import { cn } from "@/lib/utils"
import { modelSwitchVariants, ICON_SIZE_MAP, CHEVRON_SIZE_MAP } from "./constants"
import { useModelSwitchLogic } from "./hooks/useModelSwitchLogic"
import { ModelListContent } from "./components/ModelListContent"
import { AddModelStoreProvider } from "./components/AddModel/context"
import { AddModelStore } from "./components/AddModel/store"
import AddModelDialog from "./components/AddModel/AddModelDialog"
import { ChevronsUpDownIcon, Sparkles } from "lucide-react"

export const ModelSwitch: React.FC<ModelSwitchProps> = ({
	size = "default",
	selectedModel: selectedModelProp,
	isLoading = false,
	onModelChange,
	showName = true,
	showBorder = false,
	className,
	modelList,
	placement,
}) => {
	// Internal state to manage selected model for immediate UI updates
	const [internalSelectedModel, setInternalSelectedModel] = useState<ModelItem | null>(
		selectedModelProp ?? null,
	)

	const iconSize = ICON_SIZE_MAP[size]
	const chevronSize = CHEVRON_SIZE_MAP[size]
	const hasLanguageModels =
		modelList.length > 0 && modelList.some((item) => (item.models ?? []).length > 0)

	// Sync internal state with external prop changes
	useEffect(() => {
		const currentModelId = internalSelectedModel?.model_id
		const propModelId = selectedModelProp?.model_id
		if (currentModelId !== propModelId) {
			setInternalSelectedModel(selectedModelProp ?? null)
		}
	}, [selectedModelProp, internalSelectedModel?.model_id])

	const selectedModel = internalSelectedModel

	const addModelStore = useMemo(() => new AddModelStore(), [])

	const {
		isOpen,
		setIsOpen,
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
			setInternalSelectedModel(model)
			onModelChange?.(model)
		},
		shouldCloseOnSelect: true,
	})

	const fallbackContent = (
		<span
			className={cn(
				"inline-flex items-center gap-1 text-xs font-normal leading-4",
				"overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground",
				"min-w-0 flex-1",
			)}
		>
			{showName && t("messageEditor.modelSwitch.selectModel")}
		</span>
	)

	const content = isLoading ? (
		<div
			className={cn(
				"skeleton flex items-center justify-center rounded",
				size === "small" || size === "mobile" ? "h-3 w-20" : "h-4 w-24",
			)}
		/>
	) : !selectedModel ? (
		fallbackContent
	) : (
		<span
			className={cn(
				"inline-flex items-center gap-1 text-xs font-normal leading-4",
				"overflow-hidden text-ellipsis whitespace-nowrap text-secondary-foreground",
				"min-w-0 flex-1",
			)}
		>
			<ModelIcon model={selectedModel} size={iconSize} className="flex-shrink-0" />
			{showName && selectedModel.model_name}
		</span>
	)

	const mainContent = (
		<ModelListContent
			modelList={modelList}
			selectedModel={selectedModel}
			searchKeyword={searchKeyword}
			size={size}
			onModelClick={baseHandleModelClick}
			selectedItemRef={selectedItemRef}
			getModelDescription={getModelDescription}
			modelKey="models"
		/>
	)

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
		<AddModelStoreProvider value={addModelStore}>
			{isMobile ? (
				<>
					<FlexBox
						gap={showName ? 4 : 2}
						align="center"
						className={cn(
							modelSwitchVariants({ size, variant: "secondary" }),
							showBorder && "border border-border",
							!hasLanguageModels && "text-muted-foreground",
							className,
						)}
						onClick={() => setIsOpen(true)}
						data-testid="super-message-editor-model-switch-mobile"
					>
						<Sparkles size={iconSize} />
						{showName && content}
						<ChevronsUpDownIcon size={chevronSize} />
					</FlexBox>

					<MagicPopup
						visible={isOpen}
						onClose={handleClose}
						bodyClassName="rounded-t-xl p-0 bg-card"
					>
						<div className="flex w-full flex-col bg-card">
							<div className="flex min-h-[52px] items-center justify-between border-b border-border px-4 py-2.5">
								<div className="flex items-center gap-2 text-sm font-semibold leading-5 text-foreground">
									{t("messageEditor.modelSwitch.selectModel")}
								</div>
							</div>
							<div
								ref={mobileScrollContainerRef}
								className="scrollbar-y-thin flex max-h-[60vh] flex-col overflow-y-auto rounded-lg p-3"
							>
								{mainContent}
							</div>
						</div>
					</MagicPopup>
				</>
			) : (
				<DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className={cn(
								"inline-flex items-center justify-center gap-2 border-0 bg-transparent p-0",
								"outline-none",
								modelSwitchVariants({ size, variant: "secondary" }),
								showBorder && "border border-border",
								size === "small" && "max-w-[150px]",
								!hasLanguageModels && "text-muted-foreground",
								className,
							)}
							data-testid="super-message-editor-model-switch"
							data-model-id={selectedModel?.model_id}
							data-model-name={selectedModel?.model_name}
						>
							{content}
							<ChevronsUpDownIcon size={chevronSize} />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side={getSide()}
						align="start"
						className="z-dropdown w-80 overflow-visible pl-3 pr-2"
						sideOffset={4}
					>
						<div className="flex flex-col">
							<div
								ref={desktopScrollContainerRef}
								className="scrollbar-y-thin flex max-h-[340px] flex-col overflow-y-auto"
							>
								{mainContent}
							</div>
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			<AddModelDialog />
		</AddModelStoreProvider>
	)
}

export default memo(ModelSwitch)
