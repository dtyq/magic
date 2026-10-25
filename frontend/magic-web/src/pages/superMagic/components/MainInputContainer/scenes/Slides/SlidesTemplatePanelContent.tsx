import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import GroupIcon from "../../panels/GroupIcon"
import TemplateGroupSelector from "../../panels/TemplateGroupSelector"
import SlidesPresetGrid from "../../panels/slides-preset/SlidesPresetGrid"
import type { OptionItem } from "../../panels/types"
import { localeTextToDisplayString } from "../../panels/utils"
import { ALL_SLIDES_TEMPLATE_GROUP_KEY } from "./slidesTemplateState"
import {
	SlidesTemplatePrimaryFiltersSkeleton,
	SlidesTemplateTagFiltersSkeleton,
} from "./SlidesTemplateFilterSkeleton"
import SlidesTemplateTagGroupSelect from "./SlidesTemplateTagGroupSelect"
import SlidesTemplateMobileTagFilters from "./SlidesTemplateMobileTagFilters"
import type { SlidesTemplatePanelState } from "./useSlidesTemplatePanelState"
import { MY_SLIDES_TEMPLATES_GROUP_KEY } from "@/pages/superMagic/pages/SlidesTemplates/useMySlidesTemplates"
import MySlidesTemplatesEmptyState from "@/pages/superMagic/pages/SlidesTemplates/MySlidesTemplatesEmptyState"
import MySlidesTemplatesTabIcon from "./MySlidesTemplatesTabIcon"
import MySlidesTemplatesGroupTabs from "@/pages/superMagic/pages/SlidesTemplates/MySlidesTemplatesGroupTabs"
import magicToast from "@/components/base/MagicToaster/utils"
import SuperMagicService from "@/pages/superMagic/services"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"

interface SlidesTemplatePanelContentProps {
	slidesState: SlidesTemplatePanelState
	selectedTemplate?: OptionItem | null
	onTemplateClick: (template: OptionItem) => void
	onTemplateClear?: () => void
	className?: string
	toolbarClassName?: string
	gridClassName?: string
	showHoverDetails?: boolean
	hoverDetailsContainer?: HTMLElement | null
	disableEntryAnimation?: boolean
	onPreviewOpenChange?: (open: boolean) => void
	showMyTemplates?: boolean
	enableMyTemplateRemoval?: boolean
}

function SlidesTemplatePanelContent({
	slidesState,
	selectedTemplate,
	onTemplateClick,
	onTemplateClear,
	className,
	toolbarClassName,
	gridClassName,
	showHoverDetails = true,
	hoverDetailsContainer,
	disableEntryAnimation = false,
	onPreviewOpenChange,
	showMyTemplates = false,
	enableMyTemplateRemoval = false,
}: SlidesTemplatePanelContentProps) {
	const { t } = useTranslation("crew/create")
	const { t: tSuper } = useTranslation("super")
	const isMobile = useIsMobile()
	const [isSearchOpen, setIsSearchOpen] = useState(() => Boolean(slidesState.keyword.trim()))
	const [searchValue, setSearchValue] = useState(slidesState.keyword)
	const [removePendingCodes, setRemovePendingCodes] = useState<Set<string>>(() => new Set())
	const { confirm, dialog: removeConfirmDialog } = useConfirmDialog()
	const searchInputRef = useRef<HTMLInputElement>(null)
	const isComposingRef = useRef(false)
	const selectedGroupKey = slidesState.selectedGroupKey
	const isMyTemplatesSelected = selectedGroupKey === MY_SLIDES_TEMPLATES_GROUP_KEY
	const shouldHideTagFilters = showMyTemplates && isMyTemplatesSelected
	const shouldShowSourceProjectEntry =
		isMyTemplatesSelected && slidesState.myTemplatesActiveSection === "created"
	const selectorGroups = showMyTemplates
		? slidesState.groups
		: slidesState.groups.filter((group) => group.group_key !== MY_SLIDES_TEMPLATES_GROUP_KEY)
	const setSelectedGroupKey = slidesState.setSelectedGroupKey
	const hasGroups = selectorGroups.length > 1
	const hasSelectedChildTags = slidesState.selectedChildTagCodes.length > 0
	const selectedChildTagCodeSet = useMemo(
		() => new Set(slidesState.selectedChildTagCodes),
		[slidesState.selectedChildTagCodes],
	)
	const loadTemplateDetail = slidesState.loadTemplateDetail
	const handlePreviewDetailLoad = useCallback(
		(template: OptionItem): Promise<OptionItem | null> => {
			const code = typeof template.value === "string" ? template.value : ""
			return code ? loadTemplateDetail(code) : Promise.resolve(template)
		},
		[loadTemplateDetail],
	)
	const handlePreviewOpenChange = useCallback(
		(open: boolean) => {
			onPreviewOpenChange?.(open)
		},
		[onPreviewOpenChange],
	)
	const handleFavoriteToggle = useCallback(
		(template: OptionItem) => {
			void slidesState
				.toggleTemplateFavorite(template)
				.then((isFavorite) => {
					if (isFavorite === undefined) return
					magicToast.success(
						tSuper(
							isFavorite
								? "mySlidesTemplates.favoriteSuccess"
								: "mySlidesTemplates.unfavoriteSuccess",
						),
					)
				})
				.catch(() => {
					magicToast.error(tSuper("mySlidesTemplates.favoriteFailed"))
				})
		},
		[slidesState, tSuper],
	)
	const handleOpenProject = useCallback(
		(template: OptionItem) => {
			const project = template.project
			if (!project?.id || !project.directory_id) return

			void SuperMagicService.switchProjectById(project.id, undefined, undefined, {
				slidesTemplateProjectId: project.id,
				slidesTemplateDirectoryId: project.directory_id,
			}).catch((error) => {
				console.error("Failed to open slides template source project", error)
				magicToast.error(tSuper("mySlidesTemplates.openProjectFailed"))
			})
		},
		[tSuper],
	)
	const handleRemoveTemplate = useCallback(
		(template: OptionItem) => {
			const code = typeof template.value === "string" ? template.value : ""
			if (!code || slidesState.myTemplatesActiveSection !== "created") return
			const label = typeof template.label === "string" ? template.label : code
			confirm({
				title: tSuper("mySlidesTemplates.removeConfirmTitle"),
				description: tSuper("mySlidesTemplates.removeConfirmDescription", { name: label }),
				confirmText: tSuper("mySlidesTemplates.removeConfirm"),
				variant: "destructive",
				onConfirm: () => {
					setRemovePendingCodes((current) => new Set(current).add(code))
					void slidesState
						.removeTemplate(code)
						.then(() => {
							if (localeTextToDisplayString(selectedTemplate?.value) === code) {
								onTemplateClear?.()
							}
							magicToast.success(tSuper("mySlidesTemplates.removeSuccess"))
						})
						.catch(() => magicToast.error(tSuper("mySlidesTemplates.removeFailed")))
						.finally(() => {
							setRemovePendingCodes((current) => {
								const next = new Set(current)
								next.delete(code)
								return next
							})
						})
				},
			})
		},
		[confirm, onTemplateClear, selectedTemplate, slidesState, tSuper],
	)
	const handlePrimaryGroupChange = useCallback(
		(groupKey: string) => {
			if (groupKey === MY_SLIDES_TEMPLATES_GROUP_KEY && groupKey === selectedGroupKey) return

			setSelectedGroupKey(
				groupKey === selectedGroupKey ? ALL_SLIDES_TEMPLATE_GROUP_KEY : groupKey,
			)
		},
		[selectedGroupKey, setSelectedGroupKey],
	)

	useEffect(() => {
		if (!slidesState.keyword.trim()) return
		setIsSearchOpen(true)
	}, [slidesState.keyword])

	useEffect(() => {
		if (!isSearchOpen) return
		searchInputRef.current?.focus()
	}, [isSearchOpen])

	useEffect(() => {
		if (isComposingRef.current) return
		setSearchValue(slidesState.keyword)
	}, [slidesState.keyword])

	function handleSearchToggle() {
		if (isSearchOpen) {
			setSearchValue("")
			slidesState.setKeyword("")
			setIsSearchOpen(false)
			return
		}

		setIsSearchOpen(true)
	}

	function handleSearchChange(value: string) {
		setSearchValue(value)
		if (isComposingRef.current) return

		slidesState.setKeyword(value)
	}

	function handleCompositionStart() {
		isComposingRef.current = true
	}

	function handleCompositionEnd(value: string) {
		isComposingRef.current = false
		setSearchValue(value)
		slidesState.setKeyword(value)
	}

	return (
		<div className={cn("flex min-h-0 flex-col", className)}>
			<div
				className={cn(
					"flex translate-y-0 flex-col gap-3 px-4 pt-3 opacity-100",
					toolbarClassName,
				)}
				data-testid="slides-template-panel-toolbar"
			>
				<div className="flex min-w-0 items-center gap-2">
					{slidesState.isPrimaryFilterLoading ? (
						<SlidesTemplatePrimaryFiltersSkeleton />
					) : hasGroups ? (
						<TemplateGroupSelector
							groups={selectorGroups}
							selectedGroupKey={slidesState.selectedGroupKey}
							onGroupChange={handlePrimaryGroupChange}
							renderGroupIcon={(group) => {
								if (group.group_key === MY_SLIDES_TEMPLATES_GROUP_KEY) {
									return <MySlidesTemplatesTabIcon />
								}
								return group.group_icon ? (
									<GroupIcon
										icon={group.group_icon}
										className="size-4 shrink-0"
									/>
								) : null
							}}
							showEmptyGroups
							optionClassName={
								isMobile ? "h-8 px-2.5 py-1.5 text-xs [&>span]:text-xs" : undefined
							}
							className="min-w-0 flex-1"
						/>
					) : (
						<div className="min-w-0 flex-1" />
					)}
					<Button
						type="button"
						size="icon"
						variant={isSearchOpen ? "outline" : "secondary"}
						className={cn(
							"size-9 shrink-0 rounded-full border border-transparent shadow-xs",
							isSearchOpen && "border-primary bg-background text-primary",
						)}
						aria-label={
							isSearchOpen
								? t("playbook.edit.presets.close")
								: t("playbook.edit.presets.form.searchPlaceholder")
						}
						data-testid="slides-template-search-toggle"
						onClick={handleSearchToggle}
					>
						{isSearchOpen ? <X className="size-4" /> : <Search className="size-4" />}
					</Button>
				</div>
				{showMyTemplates && isMyTemplatesSelected ? (
					<div
						className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto py-0.5"
						data-testid="my-slides-templates-secondary-tabs"
					>
						<MySlidesTemplatesGroupTabs
							activeSection={slidesState.myTemplatesActiveSection}
							isSelected={isMyTemplatesSelected}
							onGroupClick={() =>
								handlePrimaryGroupChange(MY_SLIDES_TEMPLATES_GROUP_KEY)
							}
							onSectionChange={slidesState.setMyTemplatesActiveSection}
							optionProps={{
								className:
									"h-8 rounded-lg bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground shadow-none transition-none hover:bg-muted hover:text-foreground active:scale-100 data-[selected=true]:border-transparent data-[selected=true]:bg-background data-[selected=true]:font-medium data-[selected=true]:text-foreground data-[selected=true]:shadow-sm",
								icon: undefined,
								isSelected: true,
								label: "",
								"data-testid": "my-slides-templates-secondary-tab-created",
							}}
							flat
						/>
					</div>
				) : null}
				{shouldHideTagFilters ? null : slidesState.isTagFilterLoading ? (
					<SlidesTemplateTagFiltersSkeleton isMobile={isMobile} />
				) : slidesState.tagGroups.length > 0 ? (
					<div data-testid="slides-template-category-tag-filters">
						{isMobile ? (
							<SlidesTemplateMobileTagFilters
								tagGroups={slidesState.tagGroups}
								selectedTagCodes={slidesState.selectedChildTagCodes}
								onSelectedTagCodesChange={slidesState.setSelectedChildTagCodes}
							/>
						) : (
							<div className="flex min-w-0 items-start gap-2">
								<div
									className="flex min-w-0 flex-1 flex-wrap items-center gap-2 py-0.5"
									data-testid="slides-template-tag-groups"
								>
									{slidesState.tagGroups.map((tagGroup) => {
										const selectedGroupTagCodes = tagGroup.tags
											.filter((tag) => selectedChildTagCodeSet.has(tag.code))
											.map((tag) => tag.code)

										return (
											<SlidesTemplateTagGroupSelect
												key={tagGroup.code}
												tagGroup={tagGroup}
												selectedTagCodes={selectedGroupTagCodes}
												onSelectedTagCodesChange={(nextGroupTagCodes) => {
													const groupTagCodeSet = new Set(
														tagGroup.tags.map((tag) => tag.code),
													)
													const otherGroupTagCodes =
														slidesState.selectedChildTagCodes.filter(
															(tagCode) =>
																!groupTagCodeSet.has(tagCode),
														)
													slidesState.setSelectedChildTagCodes([
														...otherGroupTagCodes,
														...nextGroupTagCodes,
													])
												}}
											/>
										)
									})}
								</div>
								{hasSelectedChildTags ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="mt-0.5 h-8 shrink-0 gap-1 rounded-full px-2.5 text-xs font-normal text-muted-foreground hover:text-destructive"
										data-testid="slides-template-tag-clear-selection"
										onClick={() => slidesState.setSelectedChildTagCodes([])}
									>
										<X className="size-3.5" />
										{t("playbook.edit.presets.clearSelection")}
									</Button>
								) : null}
							</div>
						)}
					</div>
				) : null}
				{isSearchOpen ? (
					<Input
						ref={searchInputRef}
						value={searchValue}
						onChange={(event) => handleSearchChange(event.target.value)}
						onCompositionStart={handleCompositionStart}
						onCompositionEnd={(event) =>
							handleCompositionEnd(event.currentTarget.value)
						}
						placeholder={t("playbook.edit.presets.form.searchPlaceholder")}
						className="h-9 rounded-full bg-background text-sm"
						data-testid="slides-template-search-input"
					/>
				) : null}
			</div>
			{slidesState.myTemplatesEmptyStatus ? (
				<MySlidesTemplatesEmptyState
					status={slidesState.myTemplatesEmptyStatus}
					onRetry={slidesState.retryMyTemplates}
					variant="inline"
					section={slidesState.myTemplatesActiveSection}
				/>
			) : (
				<SlidesPresetGrid
					templates={slidesState.templateOptions}
					selectedTemplate={selectedTemplate ?? undefined}
					onTemplateClick={onTemplateClick}
					onFavoriteToggle={handleFavoriteToggle}
					onOpenProject={shouldShowSourceProjectEntry ? handleOpenProject : undefined}
					onRemove={
						enableMyTemplateRemoval &&
						isMyTemplatesSelected &&
						slidesState.myTemplatesActiveSection === "created"
							? handleRemoveTemplate
							: undefined
					}
					removePendingCodes={removePendingCodes}
					favoritePendingCodes={slidesState.favoritePendingCodes}
					isLoading={slidesState.isLoading}
					isRefreshing={slidesState.isRefreshing}
					hasMore={slidesState.hasMore}
					isLoadingMore={slidesState.isLoadingMore}
					isLoadMoreFailed={slidesState.isLoadMoreFailed}
					onLoadMore={slidesState.loadMore}
					onRetryLoadMore={slidesState.retryLoadMore}
					onPreviewOpenChange={handlePreviewOpenChange}
					onPreviewDetailLoad={handlePreviewDetailLoad}
					className={gridClassName}
					showHoverDetails={showHoverDetails}
					hoverDetailsContainer={hoverDetailsContainer}
					disableEntryAnimation={disableEntryAnimation}
					disableContentVisibility={isMobile}
				/>
			)}
			{removeConfirmDialog}
		</div>
	)
}

export default SlidesTemplatePanelContent
