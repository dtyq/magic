import { useMemo, useState } from "react"
import { ListFilter, RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"
import { useLocaleText } from "../../panels/hooks/useLocaleText"
import SlidesTemplateMobileFilterOption from "./SlidesTemplateMobileFilterOption"
import { getSlidesTemplateName, type SlidesTemplateTagGroupItem } from "./slidesTemplateState"
import SlidesTemplateMobileFilterPopup from "./SlidesTemplateMobileFilterPopup"
import SlidesTemplateTagGroupSelect from "./SlidesTemplateTagGroupSelect"

interface SlidesTemplateMobileTagFiltersProps {
	tagGroups: SlidesTemplateTagGroupItem[]
	selectedTagCodes: string[]
	onSelectedTagCodesChange: (tagCodes: string[]) => void
}

function SlidesTemplateMobileTagFilters({
	tagGroups,
	selectedTagCodes,
	onSelectedTagCodesChange,
}: SlidesTemplateMobileTagFiltersProps) {
	const { t } = useTranslation("crew/create")
	const lt = useLocaleText()
	const [isPanelOpen, setIsPanelOpen] = useState(false)
	const [activeTagGroupCode, setActiveTagGroupCode] = useState(tagGroups[0]?.code ?? "")
	const selectedTagCodeSet = useMemo(() => new Set(selectedTagCodes), [selectedTagCodes])
	const activeTagGroup =
		tagGroups.find((tagGroup) => tagGroup.code === activeTagGroupCode) ?? tagGroups[0]
	const panelTitle = t("playbook.edit.presets.form.moreFilters")
	const resetLabel = t("shadcn-ui:actionDrawer.reset")

	function handlePanelOpenChange(open: boolean) {
		if (open) {
			const firstSelectedGroup = tagGroups.find((tagGroup) =>
				tagGroup.tags.some((tag) => selectedTagCodeSet.has(tag.code)),
			)
			setActiveTagGroupCode(firstSelectedGroup?.code ?? tagGroups[0]?.code ?? "")
		}
		setIsPanelOpen(open)
	}

	function handleGroupSelectedTagCodesChange(
		tagGroup: SlidesTemplateTagGroupItem,
		nextGroupTagCodes: string[],
	) {
		const groupTagCodeSet = new Set(tagGroup.tags.map((tag) => tag.code))
		const otherGroupTagCodes = selectedTagCodes.filter(
			(tagCode) => !groupTagCodeSet.has(tagCode),
		)
		onSelectedTagCodesChange([...otherGroupTagCodes, ...nextGroupTagCodes])
	}

	function toggleSelectedTag(tagCode: string) {
		onSelectedTagCodesChange(
			selectedTagCodeSet.has(tagCode)
				? selectedTagCodes.filter((code) => code !== tagCode)
				: [...selectedTagCodes, tagCode],
		)
	}

	return (
		<div
			className="flex min-w-0 items-center gap-2"
			data-testid="slides-template-mobile-tag-filters"
		>
			<HeadlessHorizontalScroll
				className="min-w-0 flex-1"
				scrollContainerClassName="no-scrollbar flex min-w-0 touch-pan-x items-center gap-2 overflow-x-auto overflow-y-hidden py-0.5 pr-1"
				data-testid="slides-template-mobile-tag-filter-scroll"
				renderLeftControl={() => null}
				renderRightControl={() => null}
			>
				{tagGroups.map((tagGroup) => {
					const selectedGroupTagCodes = tagGroup.tags
						.filter((tag) => selectedTagCodeSet.has(tag.code))
						.map((tag) => tag.code)

					return (
						<SlidesTemplateTagGroupSelect
							key={tagGroup.code}
							tagGroup={tagGroup}
							selectedTagCodes={selectedGroupTagCodes}
							onSelectedTagCodesChange={(nextGroupTagCodes) =>
								handleGroupSelectedTagCodesChange(tagGroup, nextGroupTagCodes)
							}
						/>
					)
				})}
			</HeadlessHorizontalScroll>

			<Button
				type="button"
				variant="secondary"
				size="icon"
				className="relative size-8 shrink-0 rounded-full border border-transparent shadow-xs"
				aria-label={panelTitle}
				data-testid="slides-template-mobile-all-filters-trigger"
				onClick={() => handlePanelOpenChange(true)}
			>
				<ListFilter className="size-4" />
				{selectedTagCodes.length > 0 ? (
					<span
						className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
						data-testid="slides-template-mobile-all-filters-count"
					>
						{selectedTagCodes.length}
					</span>
				) : null}
			</Button>

			<SlidesTemplateMobileFilterPopup
				open={isPanelOpen}
				onOpenChange={handlePanelOpenChange}
				title={panelTitle}
				className="mx-auto h-[648px] max-h-[90vh] max-w-[375px] border border-border supports-[height:100dvh]:max-h-[90dvh] [&_.mobile-popup-action-header]:mb-0"
				contentClassName="overflow-hidden px-[10px] pb-5 pt-2"
				headerTrailingAction={
					selectedTagCodes.length > 0
						? {
								icon: <RotateCcw className="!size-5" />,
								ariaLabel: resetLabel,
								onClick: () => onSelectedTagCodesChange([]),
								testId: "slides-template-mobile-all-filters-reset",
							}
						: undefined
				}
			>
				<div
					className="flex h-full min-h-0 w-full overflow-hidden rounded-lg bg-card"
					data-testid="slides-template-mobile-all-filters-panel"
				>
					{/* Keep groups and values independently scrollable within the fixed split panel. */}
					<ScrollArea
						className="min-h-0 w-[86px] shrink-0 border-r border-border bg-card"
						viewportClassName="py-1 [&>div]:!block"
						viewportProps={{
							role: "navigation",
							"aria-label": panelTitle,
							"data-testid": "slides-template-mobile-all-filters-groups",
						}}
					>
						{tagGroups.map((tagGroup) => {
							const isActive = tagGroup.code === activeTagGroup?.code

							return (
								<button
									key={tagGroup.code}
									type="button"
									className={cn(
										"relative flex min-h-14 w-full items-center px-3 text-left text-[14px] leading-5 transition-colors active:opacity-60",
										isActive
											? "bg-primary/10 font-medium text-primary"
											: "text-muted-foreground",
									)}
									aria-current={isActive ? "page" : undefined}
									data-testid={`slides-template-mobile-all-filters-group-${tagGroup.code}`}
									onClick={() => setActiveTagGroupCode(tagGroup.code)}
								>
									{isActive ? (
										<span className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-primary" />
									) : null}
									<span className="line-clamp-2">
										{lt(getSlidesTemplateName(tagGroup))}
									</span>
								</button>
							)
						})}
					</ScrollArea>

					<ScrollArea
						className="min-h-0 min-w-0 flex-1"
						viewportClassName="px-3 py-3 [&>div]:!block"
						viewportProps={{
							"data-testid": "slides-template-mobile-all-filters-values",
						}}
					>
						<h2 className="mb-3 px-0.5 text-[14px] leading-5 text-muted-foreground">
							{activeTagGroup ? lt(getSlidesTemplateName(activeTagGroup)) : null}
						</h2>
						<div className="grid grid-cols-2 content-start gap-2">
							{activeTagGroup?.tags.map((tag) => {
								const isSelected = selectedTagCodeSet.has(tag.code)

								return (
									<SlidesTemplateMobileFilterOption
										key={tag.code}
										label={lt(getSlidesTemplateName(tag))}
										selected={isSelected}
										variant="splitSheet"
										onClick={() => toggleSelectedTag(tag.code)}
										data-testid={`slides-template-mobile-all-filters-option-${tag.code}`}
									/>
								)
							})}
						</div>
					</ScrollArea>
				</div>
			</SlidesTemplateMobileFilterPopup>
		</div>
	)
}

export default SlidesTemplateMobileTagFilters
