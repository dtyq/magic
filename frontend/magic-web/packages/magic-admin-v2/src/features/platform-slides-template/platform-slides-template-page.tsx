import { Plus, RefreshCw } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useIsFetching, useQueryClient } from "@tanstack/react-query"
import { DeleteConfirmDialog } from "@magic-admin-v2/components/delete-confirm-dialog"
import { ListShell } from "@magic-admin-v2/components/list-shell"
import { PageHeaderActionButton } from "@magic-admin-v2/components/page-header-action-button"
import { PageHeaderFilterButton } from "@magic-admin-v2/components/page-header-filter-button"
import { useListQueryParams } from "@magic-admin-v2/hooks/use-list-query-params"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs"
import { PERMISSION_KEY_MAP } from "@magic-admin-v2/constants/permissions"
import {
	CategoryManager,
	type CategoryManagerHandle,
} from "@magic-admin-v2/features/platform-slides-template/components/category-manager"
import {
	TagManager,
	type TagManagerHandle,
} from "@magic-admin-v2/features/platform-slides-template/components/tag-manager"
import { TemplateEditorSheet } from "@magic-admin-v2/features/platform-slides-template/components/template-editor-sheet"
import {
	TemplateLibrary,
	type TemplateLibraryHandle,
} from "@magic-admin-v2/features/platform-slides-template/components/template-library"
import {
	useSlidesTemplateCategoryMutations,
	useSlidesTemplateMutations,
	useSlidesTemplateTagMutations,
} from "@magic-admin-v2/features/platform-slides-template/mutations"
import { platformSlidesTemplateKeys } from "@magic-admin-v2/features/platform-slides-template/queries"
import type {
	SlidesTemplate,
	SlidesTemplateCategory,
	SlidesTemplateCategoryQueryParams,
	SlidesTemplateQueryParams,
	SlidesTemplateTag,
	SlidesTemplateTagQueryParams,
} from "@magic-admin-v2/features/platform-slides-template/types"
import {
	isSystemSlidesTemplate,
	resolveSlidesTemplateCategoryName,
	resolveSlidesTemplateTagName,
	resolveSlidesTemplateTitle,
} from "@magic-admin-v2/features/platform-slides-template/utils"
import { allowMagic } from "@magic-admin-v2/routes/access"
import { useRuntime } from "@magic-admin-v2/runtime/context"
import { cn } from "@magic-admin-v2/utils/cn"
import {
	countActiveCategoryFilters,
	countActiveTagFilters,
	countActiveTemplateLibraryFilters,
	createDefaultCategoryFilterDraft,
	createDefaultTagFilterDraft,
	createDefaultTemplateLibraryDraft,
	toCategoryListParams,
	toTagListParams,
	toTemplateLibraryParams,
	type CategoryFilterDraft,
	type TagFilterDraft,
	type TemplateLibraryFilterDraft,
} from "@magic-admin-v2/features/platform-slides-template/list-params"

type TabValue = "categories" | "library" | "tags"
type DeleteTarget = {
	id: string
	kind: "category" | "tag" | "tagGroup" | "template"
	label: string
} | null

export default function PlatformSlidesTemplatePage() {
	const { t } = useTranslation()
	const { access } = useRuntime()
	const queryClient = useQueryClient()
	const isFetching = useIsFetching({ queryKey: platformSlidesTemplateKeys.all }) > 0
	const templateLibraryRef = useRef<TemplateLibraryHandle>(null)
	const categoryManagerRef = useRef<CategoryManagerHandle>(null)
	const tagManagerRef = useRef<TagManagerHandle>(null)
	const [tab, setTab] = useState<TabValue>("library")
	const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
	const [canCreateTag, setCanCreateTag] = useState(false)
	const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
	const [editorOpen, setEditorOpen] = useState(false)
	const [selectedTemplate, setSelectedTemplate] = useState<SlidesTemplate | null>(null)
	const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
	const canEdit = Boolean(access && allowMagic(PERMISSION_KEY_MAP.SLIDES_TEMPLATE_EDIT)(access))
	const templateMutations = useSlidesTemplateMutations()
	const categoryMutations = useSlidesTemplateCategoryMutations()
	const tagMutations = useSlidesTemplateTagMutations()
	const libraryQueryState = useListQueryParams<
		TemplateLibraryFilterDraft,
		SlidesTemplateQueryParams
	>({
		debounceFields: ["keyword", "code"],
		initialDraft: createDefaultTemplateLibraryDraft,
		toParams: toTemplateLibraryParams,
	})
	const categoryQueryState = useListQueryParams<
		CategoryFilterDraft,
		SlidesTemplateCategoryQueryParams
	>({
		debounceFields: ["keyword", "code"],
		initialDraft: createDefaultCategoryFilterDraft,
		toParams: toCategoryListParams,
	})
	const toTagParams = useCallback(
		(draft: TagFilterDraft, page: number, pageSize: number) =>
			toTagListParams(draft, page, pageSize, selectedGroupId),
		[selectedGroupId],
	)
	const tagQueryState = useListQueryParams<TagFilterDraft, SlidesTemplateTagQueryParams>({
		debounceFields: ["keyword", "code"],
		extraResetKey: selectedGroupId,
		initialDraft: createDefaultTagFilterDraft,
		toParams: toTagParams,
	})
	const isDeletePending =
		deleteTarget?.kind === "template"
			? templateMutations.delete.isPending
			: deleteTarget?.kind === "category"
				? categoryMutations.delete.isPending
				: deleteTarget?.kind === "tag" || deleteTarget?.kind === "tagGroup"
					? tagMutations.delete.isPending
					: false

	const openEditor = (template?: SlidesTemplate) => {
		if (!canEdit) return
		if (template && isSystemSlidesTemplate(template)) return
		setSelectedTemplate(template ?? null)
		setEditorOpen(true)
	}
	const confirmDelete = async () => {
		if (!deleteTarget || !canEdit) return
		try {
			if (deleteTarget.kind === "template")
				await templateMutations.delete.mutateAsync(deleteTarget.id)
			else if (deleteTarget.kind === "category")
				await categoryMutations.delete.mutateAsync(deleteTarget.id)
			else await tagMutations.delete.mutateAsync(deleteTarget.id)
			toast.success(t("common.deleteSuccess"))
			setDeleteTarget(null)
		} catch (error) {
			toast.error((error as { message?: string }).message || t("common.requestFailed"))
		}
	}
	const requestTemplateDelete = (record: SlidesTemplate) => {
		setDeleteTarget({
			id: record.id,
			kind: "template",
			label: resolveSlidesTemplateTitle(record),
		})
	}
	const requestCategoryDelete = (record: SlidesTemplateCategory) => {
		setDeleteTarget({
			id: record.id,
			kind: "category",
			label: resolveSlidesTemplateCategoryName(record),
		})
	}
	const requestTagDelete = (record: SlidesTemplateTag) => {
		setDeleteTarget({
			id: record.id,
			kind: record.node_type === "group" ? "tagGroup" : "tag",
			label: resolveSlidesTemplateTagName(record),
		})
	}
	const deleteDialogTitle = !deleteTarget
		? t("slidesTemplate.delete")
		: deleteTarget.kind === "template"
			? t("slidesTemplate.deleteConfirm.templateTitle")
			: deleteTarget.kind === "category"
				? t("slidesTemplate.deleteConfirm.categoryTitle")
				: deleteTarget.kind === "tagGroup"
					? t("slidesTemplate.deleteConfirm.tagGroupTitle")
					: t("slidesTemplate.deleteConfirm.tagTitle")
	const deleteDialogDescription = !deleteTarget
		? ""
		: deleteTarget.kind === "template"
			? t("slidesTemplate.deleteConfirm.templateDescription", {
					name: deleteTarget.label,
				})
			: deleteTarget.kind === "category"
				? t("slidesTemplate.deleteConfirm.categoryDescription", {
						name: deleteTarget.label,
					})
				: deleteTarget.kind === "tagGroup"
					? t("slidesTemplate.deleteConfirm.tagGroupDescription", {
							name: deleteTarget.label,
						})
					: t("slidesTemplate.deleteConfirm.tagDescription", {
							name: deleteTarget.label,
						})
	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: platformSlidesTemplateKeys.all })
	}
	const createCurrentTab = () => {
		if (tab === "library") openEditor()
		else if (tab === "categories") categoryManagerRef.current?.create()
		else tagManagerRef.current?.create()
	}
	const createLabel =
		tab === "library"
			? t("slidesTemplate.add")
			: tab === "categories"
				? t("slidesTemplate.createCategory")
				: t("slidesTemplate.createTag")
	const createDisabled = !canEdit || (tab === "tags" && !canCreateTag)
	const handleTabChange = (value: string) => {
		setMobileFilterOpen(false)
		setTab(value as TabValue)
	}

	return (
		<>
			<ListShell
				testId="slides-template-page"
				actions={
					<>
						<PageHeaderFilterButton
							count={
								tab === "library"
									? countActiveTemplateLibraryFilters(
											libraryQueryState.filterDraft,
										)
									: tab === "categories"
										? countActiveCategoryFilters(categoryQueryState.filterDraft)
										: countActiveTagFilters(tagQueryState.filterDraft)
							}
							label={t("slidesTemplate.filterTitle")}
							onClick={() => setMobileFilterOpen(true)}
							data-testid="platform-slides-template-filter-button"
						/>
						<PageHeaderActionButton
							onClick={refresh}
							variant="outline"
							data-testid="platform-slides-template-refresh-button"
						>
							<RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
							{t("slidesTemplate.refresh")}
						</PageHeaderActionButton>
						<PageHeaderActionButton
							disabled={createDisabled}
							onClick={createCurrentTab}
							data-testid="platform-slides-template-create-button"
						>
							<Plus className="size-4" />
							{createLabel}
						</PageHeaderActionButton>
					</>
				}
				description={t("slidesTemplate.description")}
				title={t("slidesTemplate.title")}
			>
				<Tabs onValueChange={handleTabChange} value={tab}>
					<TabsList>
						<TabsTrigger
							value="library"
							data-testid="platform-slides-template-tab-trigger"
						>
							{t("slidesTemplate.library")}
						</TabsTrigger>
						<TabsTrigger
							value="categories"
							data-testid="platform-slides-template-tab-trigger"
						>
							{t("slidesTemplate.categories")}
						</TabsTrigger>
						<TabsTrigger
							value="tags"
							data-testid="platform-slides-template-tab-trigger"
						>
							{t("slidesTemplate.tags")}
						</TabsTrigger>
					</TabsList>
					<TabsContent className="mt-4" value="library">
						<TemplateLibrary
							canEdit={canEdit}
							queryState={libraryQueryState}
							mobileFilterOpen={tab === "library" && mobileFilterOpen}
							onMobileFilterOpenChange={setMobileFilterOpen}
							onDelete={requestTemplateDelete}
							onEdit={openEditor}
							ref={templateLibraryRef}
						/>
					</TabsContent>
					<TabsContent className="mt-4" value="categories">
						<CategoryManager
							canEdit={canEdit}
							queryState={categoryQueryState}
							mobileFilterOpen={tab === "categories" && mobileFilterOpen}
							onMobileFilterOpenChange={setMobileFilterOpen}
							onDelete={requestCategoryDelete}
							ref={categoryManagerRef}
						/>
					</TabsContent>
					<TabsContent className="mt-4" value="tags">
						<TagManager
							canEdit={canEdit}
							queryState={tagQueryState}
							selectedGroupId={selectedGroupId}
							onSelectedGroupIdChange={setSelectedGroupId}
							mobileFilterOpen={tab === "tags" && mobileFilterOpen}
							onCreateAvailabilityChange={setCanCreateTag}
							onMobileFilterOpenChange={setMobileFilterOpen}
							onDelete={requestTagDelete}
							ref={tagManagerRef}
						/>
					</TabsContent>
				</Tabs>
			</ListShell>
			<TemplateEditorSheet
				onOpenChange={setEditorOpen}
				open={editorOpen}
				template={selectedTemplate}
			/>
			<DeleteConfirmDialog
				contentTestId="platform-slides-template-delete-dialog-content"
				cancelButtonTestId="platform-slides-template-delete-cancel-button"
				confirmButtonTestId="platform-slides-template-delete-confirm-button"
				open={Boolean(deleteTarget)}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
				title={deleteDialogTitle}
				description={deleteDialogDescription}
				isPending={isDeletePending}
				onConfirm={confirmDelete}
			/>
		</>
	)
}
