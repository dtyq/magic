import { ImageIcon, MousePointerClick, X } from "lucide-react"
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import { useResolvedTemplateColors } from "@/pages/superMagic/pages/SlidesTemplates/useResolvedTemplateColors"
import {
	hasSlidesTemplateRandomDragType,
	SLIDES_TEMPLATE_RANDOM_DRAG_END_EVENT,
	SLIDES_TEMPLATE_RANDOM_DRAG_START_EVENT,
} from "../../constants"
import FilterBar from "../../panels/FilterBar"
import { useLocaleText } from "../../panels/hooks/useLocaleText"
import type { FieldItem, OptionItem } from "../../panels/types"
import { isComplexField } from "../../panels/utils"
import SlidesPresetPreviewDialog from "../../panels/slides-preset/SlidesPresetPreviewDialog"
import { useFinePointerHover } from "../../panels/slides-preset/useFinePointerHover"
import AIAutoSelectVisual from "./AIAutoSelectVisual"
import SlidesTemplateSelectionDialog from "./SlidesTemplateSelectionDialog"

interface SlidesTemplateHomeSelectionPreviewProps {
	filters: FieldItem[]
	onClear?: () => void
	onRandomTemplateRequest?: () => void
	onTemplatePickerContainerChange?: (container: HTMLDivElement | null) => void
	onFilterChange: (filterId: string, value: string) => void
	template?: OptionItem | null
	templatePickerOpen?: boolean
	onTemplatePickerOpenChange?: (open: boolean) => void
	showTemplateActions?: boolean
	className?: string
	isTemplatePreviewOpen?: boolean
	/** Apply the compact single-row layout only in the topic panel. */
	compactLayout?: boolean
}

function getTemplateCoverUrl(template: OptionItem) {
	return template.thumbnail_url ?? template.preview_image_urls?.[0] ?? template.collage_url
}

export default function SlidesTemplateHomeSelectionPreview({
	filters,
	onClear,
	onRandomTemplateRequest,
	onTemplatePickerContainerChange,
	onFilterChange,
	template,
	templatePickerOpen,
	onTemplatePickerOpenChange,
	showTemplateActions = true,
	className,
	isTemplatePreviewOpen = false,
	compactLayout = false,
}: SlidesTemplateHomeSelectionPreviewProps) {
	const { t } = useTranslation("crew/create")
	const { t: tSuper } = useTranslation("super")
	const lt = useLocaleText()
	const templateName = template
		? lt(template.label) || lt(template.value) || String(template.value)
		: ""
	const coverUrl = template ? getTemplateCoverUrl(template) : undefined
	const colors = useResolvedTemplateColors({
		colors: template?.colors,
		enabled: Boolean(template),
		imageUrl: coverUrl,
		priority: "interactive",
	})
	const simpleFilters = filters.filter((filter) => !isComplexField(filter))
	const canUseHoverActions = useFinePointerHover()
	const [isPreviewOpen, setIsPreviewOpen] = useState(false)
	const [internalTemplatePickerOpen, setInternalTemplatePickerOpen] = useState(false)
	const [isTemplatePickerReady, setIsTemplatePickerReady] = useState(true)
	const [isTemplateActionsDismissed, setIsTemplateActionsDismissed] = useState(false)
	const [isRandomDragActive, setIsRandomDragActive] = useState(false)
	const [isRandomDropActive, setIsRandomDropActive] = useState(false)
	const randomDragDepthRef = useRef(0)
	const templateActionsRef = useRef<HTMLDivElement>(null)
	const isTemplatePointerInsideRef = useRef(false)
	const waitForTemplatePointerLeaveRef = useRef(false)
	const isTemplatePickerOpen = templatePickerOpen ?? internalTemplatePickerOpen
	const setTemplatePickerOpen = (open: boolean) => {
		setInternalTemplatePickerOpen(open)
		onTemplatePickerOpenChange?.(open)
	}

	useEffect(() => {
		if (!onRandomTemplateRequest) return

		const handleRandomDragStart = () => setIsRandomDragActive(true)
		const handleRandomDragEnd = () => {
			randomDragDepthRef.current = 0
			setIsRandomDragActive(false)
			setIsRandomDropActive(false)
		}

		window.addEventListener(SLIDES_TEMPLATE_RANDOM_DRAG_START_EVENT, handleRandomDragStart)
		window.addEventListener(SLIDES_TEMPLATE_RANDOM_DRAG_END_EVENT, handleRandomDragEnd)
		return () => {
			window.removeEventListener(
				SLIDES_TEMPLATE_RANDOM_DRAG_START_EVENT,
				handleRandomDragStart,
			)
			window.removeEventListener(SLIDES_TEMPLATE_RANDOM_DRAG_END_EVENT, handleRandomDragEnd)
		}
	}, [onRandomTemplateRequest])

	const handleClear = () => {
		setTemplatePickerOpen(false)
		setIsTemplatePickerReady(false)
		onClear?.()
		window.setTimeout(() => setIsTemplatePickerReady(true), 0)
	}

	const handleTemplatePickerOpenChange = (open: boolean) => {
		if (!open && isTemplatePreviewOpen) return
		setTemplatePickerOpen(open)
	}

	const previousTemplatePickerOpenRef = useRef(isTemplatePickerOpen)
	useEffect(() => {
		const wasOpen = previousTemplatePickerOpenRef.current
		previousTemplatePickerOpenRef.current = isTemplatePickerOpen
		if (!wasOpen || isTemplatePickerOpen) return

		const isPointerInside = canUseHoverActions && isTemplatePointerInsideRef.current
		waitForTemplatePointerLeaveRef.current = isPointerInside
		setIsTemplateActionsDismissed(isPointerInside)
		const activeElement = document.activeElement
		if (
			activeElement instanceof HTMLElement &&
			templateActionsRef.current?.contains(activeElement)
		) {
			activeElement.blur()
		}
	}, [canUseHoverActions, isTemplatePickerOpen, template])

	const renderTemplatePicker = (trigger: ReactNode) => {
		if (!onTemplatePickerContainerChange || !isTemplatePickerReady) return trigger

		return (
			<>
				{trigger}
				<SlidesTemplateSelectionDialog
					open={isTemplatePickerOpen}
					title={tSuper("ppt.templateReplacement.title")}
					onOpenChange={handleTemplatePickerOpenChange}
				>
					<div
						ref={onTemplatePickerContainerChange}
						className="flex h-full min-h-0 flex-col overflow-hidden"
					/>
				</SlidesTemplateSelectionDialog>
			</>
		)
	}

	const isRandomTemplateDrag = (event: DragEvent<HTMLDivElement>) =>
		hasSlidesTemplateRandomDragType(event.dataTransfer)

	const handleRandomDragEnter = (event: DragEvent<HTMLDivElement>) => {
		if (!onRandomTemplateRequest || !isRandomTemplateDrag(event)) return
		event.preventDefault()
		randomDragDepthRef.current += 1
		setIsRandomDropActive(true)
	}

	const handleRandomDragOver = (event: DragEvent<HTMLDivElement>) => {
		if (!onRandomTemplateRequest || !isRandomTemplateDrag(event)) return
		event.preventDefault()
		event.dataTransfer.dropEffect = "copy"
	}

	const handleRandomDragLeave = (event: DragEvent<HTMLDivElement>) => {
		if (!onRandomTemplateRequest || !isRandomTemplateDrag(event)) return
		randomDragDepthRef.current = Math.max(0, randomDragDepthRef.current - 1)
		if (randomDragDepthRef.current === 0) setIsRandomDropActive(false)
	}

	const handleRandomDrop = (event: DragEvent<HTMLDivElement>) => {
		if (!onRandomTemplateRequest || !isRandomTemplateDrag(event)) return
		event.preventDefault()
		randomDragDepthRef.current = 0
		setIsRandomDragActive(false)
		setIsRandomDropActive(false)
		onRandomTemplateRequest()
	}

	const selectionContent = template ? (
		<div className="flex min-w-[40%] max-w-fit flex-1 items-center gap-3 overflow-hidden">
			<div className="relative shrink-0">
				<div
					ref={templateActionsRef}
					className="group relative flex aspect-video w-20 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-inset ring-black/[0.06] transition-shadow focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:ring-black/[0.16] sm:w-24"
					onPointerEnter={() => {
						if (!showTemplateActions) return
						if (!canUseHoverActions) return
						isTemplatePointerInsideRef.current = true
						if (!waitForTemplatePointerLeaveRef.current) {
							setIsTemplateActionsDismissed(false)
						}
					}}
					onPointerLeave={() => {
						if (!showTemplateActions) return
						if (!canUseHoverActions) return
						isTemplatePointerInsideRef.current = false
						waitForTemplatePointerLeaveRef.current = false
						setIsTemplateActionsDismissed(false)
					}}
					data-testid="slides-template-home-thumbnail"
				>
					<div className="flex size-full items-center justify-center">
						{coverUrl ? (
							<img
								crossOrigin="anonymous"
								src={coverUrl}
								alt={templateName}
								className="size-full object-cover"
								decoding="async"
								draggable={false}
							/>
						) : (
							<ImageIcon className="size-4 text-muted-foreground" />
						)}
					</div>
					{showTemplateActions ? (
						<div
							className={cn(
								"absolute inset-0 flex items-center justify-center gap-1 bg-black/45 transition-opacity",
								canUseHoverActions && isTemplateActionsDismissed
									? "pointer-events-none opacity-0"
									: canUseHoverActions
										? "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
										: "opacity-100",
							)}
							data-interaction-mode={canUseHoverActions ? "hover" : "touch"}
							data-testid="slides-template-home-actions"
						>
							{renderTemplatePicker(
								<button
									type="button"
									className="h-7 rounded-md bg-white/95 px-2 text-xs font-medium text-neutral-900 shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
									aria-label={t("playbook.edit.presets.form.replaceTemplate")}
									aria-haspopup="dialog"
									aria-expanded={isTemplatePickerOpen}
									onClick={() => {
										if (onTemplatePickerContainerChange) {
											setTemplatePickerOpen(true)
											return
										}
										handleClear()
									}}
									disabled={!onTemplatePickerContainerChange && !onClear}
									data-testid="slides-template-home-replace-selected-template"
								>
									{t("playbook.edit.presets.form.replaceTemplate")}
								</button>,
							)}
							<button
								type="button"
								className="h-7 rounded-md bg-white/95 px-2 text-xs font-medium text-neutral-900 shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
								aria-label={t("playbook.edit.presets.form.preview")}
								onClick={() => setIsPreviewOpen(true)}
								data-testid="slides-template-home-preview-selected-template"
							>
								{t("playbook.edit.presets.form.preview")}
							</button>
						</div>
					) : (
						<button
							type="button"
							className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
							aria-label={t("playbook.edit.presets.form.preview")}
							onClick={() => setIsPreviewOpen(true)}
							data-testid="slides-template-home-preview-selected-template"
						/>
					)}
				</div>
				{onClear ? (
					<Button
						type="button"
						size="icon"
						variant="ghost"
						className="absolute -right-1.5 -top-1.5 size-6 rounded-full border border-black/[0.08] bg-white text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
						aria-label={t("playbook.edit.presets.clearSelection")}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.preventDefault()
							event.stopPropagation()
							handleClear()
						}}
						data-testid="slides-template-home-clear-selected-template"
					>
						<X className="size-3.5" />
					</Button>
				) : null}
			</div>

			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium text-foreground">
					{t("playbook.edit.presets.form.selectedTemplate", { name: templateName })}
				</p>
				{colors.length > 0 ? (
					<div className="mt-1.5 flex items-center gap-1" aria-label={templateName}>
						{colors.map((color) => (
							<span
								key={color}
								className="size-3 rounded-full border border-black/10 shadow-sm"
								style={{ backgroundColor: color }}
								title={color}
							/>
						))}
					</div>
				) : null}
			</div>
		</div>
	) : onTemplatePickerContainerChange && isTemplatePickerReady ? (
		<div className={cn("flex min-w-[240px] flex-1", compactLayout && "md:flex-none")}>
			{renderTemplatePicker(
				<button
					type="button"
					// Keep the compact topic-panel trigger centered without changing the spacious home layout.
					className={cn(
						"group relative flex min-h-[70px] min-w-0 flex-1 items-center overflow-hidden rounded-lg px-4 text-left outline-none transition-shadow hover:shadow-[0_4px_16px_rgba(139,92,246,0.1)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
						compactLayout && "md:h-11 md:min-h-0",
					)}
					aria-label={t("playbook.edit.presets.title")}
					aria-haspopup="dialog"
					aria-expanded={isTemplatePickerOpen}
					onClick={
						onTemplatePickerContainerChange
							? () => setTemplatePickerOpen(true)
							: undefined
					}
					data-testid="slides-template-home-choose-template"
				>
					<AIAutoSelectVisual />
					<div className="relative z-10 min-w-0 flex-1">
						<p
							className={cn(
								"whitespace-normal break-words text-sm font-medium leading-5 text-slate-900 transition-colors group-hover:text-violet-950",
								compactLayout && "md:whitespace-nowrap md:break-normal",
							)}
						>
							{t("playbook.edit.presets.form.selectOrAutoSelectTemplate")}
						</p>
					</div>
				</button>,
			)}
		</div>
	) : (
		<div
			className={cn(
				"relative flex min-h-[70px] min-w-0 flex-1 items-center overflow-hidden px-4",
				compactLayout && "h-[70px] min-h-0 md:min-w-[240px] md:flex-none",
			)}
		>
			<AIAutoSelectVisual />
			<div className="relative z-10 min-w-0">
				<p
					className={cn(
						"whitespace-normal break-words text-sm font-medium leading-5 text-slate-900",
						compactLayout && "md:whitespace-nowrap md:break-normal",
					)}
				>
					{t("playbook.edit.presets.form.autoSelectTemplate")}
				</p>
			</div>
			{onRandomTemplateRequest ? (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="relative z-10 ml-3 h-8 shrink-0 gap-1.5 rounded-full border-violet-200/80 bg-white/75 px-3 text-xs font-medium text-violet-700 shadow-sm backdrop-blur-sm hover:border-violet-300 hover:bg-white hover:text-violet-900"
					aria-label={t("playbook.edit.presets.form.randomSelectTemplate")}
					onClick={onRandomTemplateRequest}
					data-testid="slides-template-home-random-template"
				>
					<MousePointerClick className="size-3.5" />
					{t("playbook.edit.presets.form.randomSelectTemplate")}
				</Button>
			) : null}
		</div>
	)

	// Compact topic-panel mode keeps the template on the left and filters on the right; the home layout stays adaptive.
	return (
		<div
			className={cn(
				"relative flex min-w-0 flex-wrap items-center rounded-xl border bg-white/90 shadow-[0_6px_18px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-200",
				compactLayout && "md:flex-nowrap",
				template
					? "gap-3 px-3 py-2"
					: compactLayout
						? "h-[70px] gap-0 overflow-hidden"
						: "gap-0 overflow-hidden",
				isRandomDropActive
					? "scale-[1.01] border-violet-400 shadow-[0_12px_32px_rgba(124,58,237,0.2)] ring-2 ring-violet-300/40"
					: isRandomDragActive
						? "border-violet-300 bg-violet-50/30 shadow-[0_10px_28px_rgba(124,58,237,0.12)] ring-1 ring-violet-200/70"
						: "border-black/[0.08]",
				className,
			)}
			data-testid="slides-template-home-selected-template"
			data-random-drag-active={isRandomDragActive}
			data-random-drop-active={isRandomDropActive}
			onDragEnter={handleRandomDragEnter}
			onDragOver={handleRandomDragOver}
			onDragLeave={handleRandomDragLeave}
			onDrop={handleRandomDrop}
		>
			{isRandomDragActive ? (
				<div
					className={cn(
						"pointer-events-none absolute inset-1 z-20 rounded-lg border-2 transition-colors duration-150",
						isRandomDropActive
							? "border-violet-500 bg-violet-100/15"
							: "border-dashed border-violet-300/80",
					)}
					data-testid="slides-template-random-drag-feedback"
				/>
			) : null}
			{selectionContent}
			<div
				className={`order-last w-full min-w-0 border-t border-black/[0.06] md:order-none md:w-auto md:border-t-0 ${
					compactLayout
						? `md:ml-auto md:min-w-0 md:flex-[0_1_auto] ${template ? "pt-2 md:pl-4 md:pt-0" : "px-3 py-2 md:py-0 md:pl-2 md:pr-3"}`
						: template
							? "pt-2 md:ml-auto md:pt-0"
							: "px-3 py-2 md:py-0 md:pl-2 md:pr-3"
				}`}
			>
				<FilterBar
					filters={simpleFilters}
					onFilterChange={onFilterChange}
					itemGapClassName="gap-2"
					scrollContainerClassName="justify-start px-0"
				/>
			</div>
			<SlidesPresetPreviewDialog
				template={template ?? null}
				open={isPreviewOpen}
				onOpenChange={setIsPreviewOpen}
			/>
		</div>
	)
}
