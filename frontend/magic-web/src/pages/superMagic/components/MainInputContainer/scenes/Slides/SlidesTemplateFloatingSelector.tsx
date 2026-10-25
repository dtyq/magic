import { useCallback, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, CircleX, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicDropdown from "@/components/base/MagicDropdown"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Button } from "@/components/shadcn-ui/button"
import { Label } from "@/components/shadcn-ui/label"
import { cn } from "@/utils/cn"
import { ScenePanelVariant } from "../../components/LazyScenePanel/types"
import FilterBar from "../../panels/FilterBar"
import { useLocaleText } from "../../panels/hooks/useLocaleText"
import type { FieldItem, OptionItem } from "../../panels/types"
import SlidesTemplatePanelContent from "./SlidesTemplatePanelContent"
import type { SlidesTemplatePanelState } from "./useSlidesTemplatePanelState"

interface SlidesTemplateFloatingSelectorProps {
	title: string
	selectedTemplate: OptionItem | null
	hideTrigger?: boolean
	templateCountLabel: string
	simpleFields: FieldItem[]
	slidesState: SlidesTemplatePanelState
	onFilterChange: (filterId: string, value: string) => void
	onTemplateClick: (template: OptionItem) => void
	onTemplateClear: () => void
	templatePickerContainer?: HTMLDivElement | null
	readOnly?: boolean
	variant?: ScenePanelVariant
	compact?: boolean
	onPreviewOpenChange?: (open: boolean) => void
}

function SlidesTemplateFloatingSelector({
	title,
	selectedTemplate,
	hideTrigger = false,
	templateCountLabel,
	simpleFields,
	slidesState,
	onFilterChange,
	onTemplateClick,
	onTemplateClear,
	templatePickerContainer,
	readOnly = false,
	variant,
	compact = false,
	onPreviewOpenChange,
}: SlidesTemplateFloatingSelectorProps) {
	const { t } = useTranslation("crew/create")
	const lt = useLocaleText()
	const [open, setOpen] = useState(false)
	const [isPreviewOpen, setIsPreviewOpen] = useState(false)
	const [hoverDetailsContainer, setHoverDetailsContainer] = useState<HTMLDivElement | null>(null)
	const isMobile = variant === ScenePanelVariant.Mobile
	const isCompactMobile = compact && isMobile
	const selectedTemplateTitle =
		lt(selectedTemplate?.label) ?? lt(selectedTemplate?.value) ?? templateCountLabel

	const handleTemplateClick = useCallback(
		(template: OptionItem) => {
			onTemplateClick(template)
			setOpen(false)
		},
		[onTemplateClick],
	)

	const handleDropdownOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen && isPreviewOpen) return
			setOpen(nextOpen)
		},
		[isPreviewOpen],
	)

	const handlePreviewOpenChange = useCallback(
		(nextOpen: boolean) => {
			setIsPreviewOpen(nextOpen)
			onPreviewOpenChange?.(nextOpen)
		},
		[onPreviewOpenChange],
	)
	const clearSelectionText = t("playbook.edit.presets.clearSelection")

	const trigger = (
		<Button
			type="button"
			variant="outline"
			size="sm"
			disabled={readOnly}
			className={cn(
				"group h-8 max-w-[220px] justify-start rounded-full bg-background px-3 font-normal shadow-xs dark:bg-card",
				!selectedTemplate && "text-muted-foreground",
				isCompactMobile &&
					"h-8 min-h-8 shrink-0 gap-1 border-border bg-card pl-2.5 pr-2 text-foreground shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] dark:bg-card",
			)}
			aria-label={title}
			data-testid="slides-template-floating-selector-trigger"
			onClick={() => setOpen(true)}
		>
			<span className="flex min-w-0 items-center gap-2 truncate">
				{isCompactMobile ? (
					<>
						<span className="whitespace-nowrap text-[11px] text-muted-foreground">
							{title}
						</span>
						<span className="whitespace-nowrap text-[13px] font-medium text-foreground">
							{selectedTemplateTitle}
						</span>
					</>
				) : (
					selectedTemplateTitle
				)}
			</span>
			<span className="relative inline-flex size-4 shrink-0 items-center justify-center">
				{isMobile && selectedTemplate ? (
					<span
						role="button"
						tabIndex={0}
						aria-label={clearSelectionText}
						className={cn(
							"inline-flex items-center justify-center rounded-full text-muted-foreground/70",
							isCompactMobile && "-m-2 size-8 active:bg-muted",
						)}
						onPointerDown={(event) => {
							event.preventDefault()
							event.stopPropagation()
						}}
						onClick={(event) => {
							event.preventDefault()
							event.stopPropagation()
							onTemplateClear()
						}}
						onKeyDown={(event) => {
							if (event.key !== "Enter" && event.key !== " ") return
							event.preventDefault()
							event.stopPropagation()
							onTemplateClear()
						}}
						data-testid="slides-template-floating-selector-clear-button"
					>
						<CircleX className="size-4 opacity-50" />
					</span>
				) : (
					<ChevronDown className="size-4 text-muted-foreground opacity-50 transition-opacity" />
				)}
			</span>
		</Button>
	)

	const panelContent = useMemo(
		() => (
			<div
				ref={setHoverDetailsContainer}
				className={cn(
					"relative flex min-h-0 flex-col overflow-hidden",
					isMobile || hideTrigger ? "h-full" : "h-[min(640px,70vh)] min-h-[360px]",
				)}
			>
				<SlidesTemplatePanelContent
					slidesState={slidesState}
					selectedTemplate={selectedTemplate}
					onTemplateClick={handleTemplateClick}
					showMyTemplates
					className="h-full"
					toolbarClassName={isMobile ? "px-2 pt-0" : "px-0 pt-0"}
					gridClassName={cn(
						"min-h-0 flex-1",
						isMobile
							? "p-2"
							: templatePickerContainer
								? "p-0 pt-1 ![grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr))]"
								: "p-0 pt-1 2xl:!grid-cols-4",
					)}
					hoverDetailsContainer={hoverDetailsContainer}
					disableEntryAnimation={isMobile}
					onPreviewOpenChange={handlePreviewOpenChange}
				/>
			</div>
		),
		[
			handlePreviewOpenChange,
			handleTemplateClick,
			hideTrigger,
			hoverDetailsContainer,
			isMobile,
			selectedTemplate,
			slidesState,
			templatePickerContainer,
		],
	)

	const selector = isMobile ? (
		<>
			{trigger}
			<MagicPopup
				visible={open}
				onClose={() => handleDropdownOpenChange(false)}
				className={cn(
					"flex h-[min(98dvh,calc(100dvh-var(--safe-area-inset-top)-0.5rem))] max-h-[calc(100dvh-var(--safe-area-inset-top)-0.5rem)] flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted",
					"data-[vaul-drawer-direction=bottom]:!mt-[max(0.5rem,var(--safe-area-inset-top))]",
				)}
				bodyClassName="flex max-h-none min-h-0 flex-1 flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
				handlerClassName="bg-muted-foreground mb-1.5 h-1 w-20 rounded-full"
				title={title}
			>
				<div
					className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden bg-muted"
					data-testid="slides-template-floating-selector-mobile-popup"
				>
					<div className="relative flex h-14 shrink-0 flex-row items-center justify-center">
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-card"
							style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
							aria-label={t("playbook.edit.presets.close")}
							data-testid="slides-template-floating-selector-mobile-close"
						>
							<X className="h-[22px] w-[22px] text-foreground" />
						</button>
						<div className="max-w-[247px] truncate text-center text-lg font-semibold leading-none text-foreground">
							{title}
						</div>
					</div>
					<div className="min-h-0 flex-1 overflow-hidden px-2 pb-4">{panelContent}</div>
				</div>
			</MagicPopup>
		</>
	) : (
		<MagicDropdown
			trigger={["click"]}
			open={open}
			onOpenChange={handleDropdownOpenChange}
			keepOpenOnNestedOverlay
			contentRole="panel"
			popupRender={() => panelContent}
			overlayClassName="w-[min(90vw,760px)] min-w-[360px] overflow-visible rounded-lg border border-border bg-popover p-3 shadow-xl"
		>
			{trigger}
		</MagicDropdown>
	)

	if (hideTrigger) {
		return templatePickerContainer ? createPortal(panelContent, templatePickerContainer) : null
	}
	const templateSelector = (
		<div className="flex shrink-0 items-center gap-2">
			<Label className="shrink-0 text-sm font-normal text-foreground">{title}</Label>
			{selector}
		</div>
	)

	if (isCompactMobile) {
		return (
			<div className="min-w-0 flex-1 overflow-hidden">
				<FilterBar
					filters={simpleFields}
					onFilterChange={onFilterChange}
					variant={variant}
					compact={compact}
					prefix={selector}
					scrollContainerClassName="px-0 justify-start"
				/>
			</div>
		)
	}

	if (!isMobile) {
		return (
			<div className="min-w-0 flex-1 overflow-hidden">
				<FilterBar
					filters={simpleFields}
					onFilterChange={onFilterChange}
					variant={variant}
					compact={compact}
					prefix={templateSelector}
					itemGapClassName="gap-2"
					scrollContainerClassName="px-0 justify-start"
				/>
			</div>
		)
	}

	return (
		<div className="flex min-w-0 flex-col items-start gap-1">
			{templateSelector}
			{simpleFields.length > 0 ? (
				<div className="min-w-0 flex-1">
					<FilterBar
						filters={simpleFields}
						onFilterChange={onFilterChange}
						variant={variant}
						compact={compact}
						scrollContainerClassName="px-0 justify-start"
					/>
				</div>
			) : null}
		</div>
	)
}

export default SlidesTemplateFloatingSelector
