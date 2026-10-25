import { Boxes, Loader2, Plus, RotateCcw, Save } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { DndContext, DragOverlay } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { createPortal } from "react-dom"
import { DeleteConfirmDialog } from "@magic-admin-v2/components/delete-confirm-dialog"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { EntityAvatarRender } from "@magic-admin-v2/components/entity-avatar-render"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@magic-admin-v2/components/ui/dialog"
import { PortalThemeScope } from "@magic-admin-v2/components/ui/portal-theme-scope"
import { Tabs, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { Separator } from "@magic-admin-v2/components/ui/separator"
import { Skeleton } from "@magic-admin-v2/components/ui/skeleton"
import { AllModelsPanel } from "@magic-admin-v2/features/platform-official-staff/components/assignment/all-models-panel"
import { GroupFormDialog } from "@magic-admin-v2/features/platform-official-staff/components/assignment/assignment-dialogs"
import { ModelGroupCard } from "@magic-admin-v2/features/platform-official-staff/components/assignment/model-group-card"
import { useAssignmentActions } from "@magic-admin-v2/features/platform-official-staff/hooks/use-assignment-actions"
import { useAssignmentDnd } from "@magic-admin-v2/features/platform-official-staff/hooks/use-assignment-dnd"
import { useOfficialStaffDetailQuery } from "@magic-admin-v2/features/platform-official-staff/queries"
import {
	staffDistributionType,
	staffModelCategory,
	type OfficialStaff,
	type OfficialStaffDetail,
	type OfficialStaffModelOption,
	type StaffModelCategory,
} from "@magic-admin-v2/features/platform-official-staff/types"
import {
	dynamicModelIcon,
	dynamicModelId,
	getActivePreviewMeta,
	getI18nText,
	staffCollisionDetection,
	type AssignmentConfirmAction,
	type DragPreviewMeta,
	type GroupDialogState,
	type NewGroupPendingModel,
} from "@magic-admin-v2/features/platform-official-staff/utils/page-utils"
import { useI18n } from "@magic-admin-v2/i18n/use-i18n"
import { useTranslation } from "react-i18next"

function DragPreviewItem({ meta }: { meta: DragPreviewMeta | null }) {
	if (!meta) return null

	return (
		<div className="pointer-events-none flex h-11 min-w-[280px] items-center gap-2 rounded-lg border bg-background p-2 shadow-xl ring-1 ring-border/70">
			<EntityAvatarRender
				alt={meta.title}
				className="size-6"
				fallbackIcon={<Boxes className="size-3.5" aria-hidden="true" />}
				name={meta.title}
				src={meta.icon}
			/>
			<div className="flex min-w-0 items-baseline gap-2">
				<div className="truncate text-xs font-medium text-foreground">{meta.title}</div>
				{meta.subtitle ? (
					<div className="truncate text-[11px] text-muted-foreground">
						{meta.subtitle}
					</div>
				) : null}
			</div>
		</div>
	)
}
export function AssignModelsDialog({
	allModels,
	canEdit,
	modeOptions,
	onOpenChange,
	open,
	staff,
}: {
	allModels: OfficialStaffModelOption[]
	canEdit: boolean
	modeOptions: OfficialStaff[]
	onOpenChange: (open: boolean) => void
	open: boolean
	staff: OfficialStaff | null
}) {
	const { t } = useTranslation()
	const { language } = useI18n()
	const [detail, setDetail] = useState<OfficialStaffDetail | null>(null)
	const [groupDialog, setGroupDialog] = useState<GroupDialogState>({ group: null, open: false })
	const [newGroupPendingModel, setNewGroupPendingModel] = useState<NewGroupPendingModel>(null)
	const [openFloatingId, setOpenFloatingId] = useState<string | null>(null)
	const [confirmAction, setConfirmAction] = useState<AssignmentConfirmAction | null>(null)
	const [category, setCategory] = useState<StaffModelCategory>(staffModelCategory.text)
	const detailQuery = useOfficialStaffDetailQuery(open && staff ? staff.id : null)

	useEffect(() => {
		setDetail(null)
		setOpenFloatingId(null)
		setConfirmAction(null)
		setCategory(staffModelCategory.text)
	}, [open, staff?.id])

	useEffect(() => {
		if (!open || !detailQuery.data) return
		setDetail((current) => current ?? detailQuery.data)
	}, [detailQuery.data, open])

	const modelOptions = useMemo<OfficialStaffModelOption[]>(
		() => [
			{
				description: t("officialStaff.model.dynamicDescription"),
				icon: dynamicModelIcon,
				id: dynamicModelId,
				model_id: dynamicModelId,
				name: t("officialStaff.model.dynamic"),
			},
			...allModels.filter(
				(model) =>
					model.category?.toLowerCase() ===
					(category === "text" ? "llm" : category === "image" ? "vlm" : "vgm"),
			),
		],
		[allModels, category, t],
	)

	const isDefaultConfig = staff?.is_default === 1
	const isFollow =
		!isDefaultConfig && detail?.mode.distribution_type === staffDistributionType.follow
	const editable = canEdit && Boolean(detail) && !isFollow

	const {
		defaultDetailPending,
		deleteGroupPending,
		handleAddModel,
		handleConfirmAction,
		handleDistributionChange,
		handleFollowModeChange,
		handleSave,
		saveConfigPending,
	} = useAssignmentActions({
		canEdit,
		category,
		confirmAction,
		detail,
		isDefaultConfig,
		onFloatingOpenChange: setOpenFloatingId,
		onOpenChange,
		setConfirmAction,
		setDetail,
		staff,
	})

	const handleCreateGroupForModel = (model: OfficialStaffModelOption) => {
		if (!canEdit) return
		setNewGroupPendingModel(model)
		setGroupDialog({ group: null, open: true })
	}

	const {
		activeDragData,
		dropIndicator,
		handleDragCancel,
		handleDragEnd,
		handleDragOver,
		handleDragStart,
		sensors,
	} = useAssignmentDnd({
		canEdit,
		category,
		detail,
		editable,
		onAddModel: handleAddModel,
		onFloatingOpenChange: setOpenFloatingId,
		open,
		setDetail,
	})

	let confirmTitle = ""
	let confirmDescription = ""
	if (confirmAction?.kind === "reset") {
		confirmTitle = t("officialStaff.confirm.resetTitle")
		confirmDescription = t("officialStaff.confirm.resetDescription")
	} else if (confirmAction?.kind === "group") {
		confirmTitle = t("officialStaff.confirm.deleteGroupTitle")
		confirmDescription = t("officialStaff.confirm.deleteGroupDescription", {
			name: confirmAction.name,
		})
	} else if (confirmAction?.kind === "model") {
		confirmTitle = t(
			confirmAction.isDynamic
				? "officialStaff.confirm.deleteDynamicModelTitle"
				: "officialStaff.confirm.deleteModelTitle",
		)
		confirmDescription = t(
			confirmAction.isDynamic
				? "officialStaff.confirm.deleteDynamicModelDescription"
				: "officialStaff.confirm.deleteModelDescription",
			{ name: confirmAction.name },
		)
	} else if (confirmAction?.kind === "subModel") {
		confirmTitle = t("officialStaff.confirm.deleteSubModelTitle")
		confirmDescription = t("officialStaff.confirm.deleteSubModelDescription", {
			name: confirmAction.name,
		})
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[min(860px,calc(100vh-48px))] overflow-hidden sm:max-w-5xl"
				data-testid="platform-official-staff-dialog-content"
				closeButtonTestId="assign-models-dialog-close-button"
			>
				<DialogHeader>
					<DialogTitle>
						{isDefaultConfig
							? t("officialStaff.assign.defaultTitle")
							: staff
								? t("officialStaff.assign.titleWithName", {
										name: getI18nText(staff.name_i18n, language),
									})
								: t("officialStaff.assign.title")}
					</DialogTitle>
					<DialogDescription>
						{isDefaultConfig
							? t("officialStaff.assign.defaultDescription")
							: t("officialStaff.assign.description")}
					</DialogDescription>
				</DialogHeader>
				{detailQuery.isLoading || !detail ? (
					<AssignDialogSkeleton />
				) : (
					<DndContext
						sensors={sensors}
						collisionDetection={staffCollisionDetection}
						onDragStart={handleDragStart}
						onDragOver={handleDragOver}
						onDragEnd={handleDragEnd}
						onDragCancel={handleDragCancel}
					>
						<div className="flex h-[min(650px,calc(100vh-220px))] min-h-0 flex-col gap-4 overflow-hidden">
							<Tabs
								className="shrink-0"
								onValueChange={(value) => {
									handleDragCancel()
									setOpenFloatingId(null)
									setCategory(value as StaffModelCategory)
								}}
								value={category}
							>
								<TabsList>
									<TabsTrigger
										data-testid="platform-official-staff-tab-trigger"
										value={staffModelCategory.text}
									>
										{t("officialStaff.category.text")}
									</TabsTrigger>
									<TabsTrigger
										data-testid="platform-official-staff-tab-trigger"
										value={staffModelCategory.image}
									>
										{t("officialStaff.category.image")}
									</TabsTrigger>
									<TabsTrigger
										data-testid="platform-official-staff-tab-trigger"
										value={staffModelCategory.video}
									>
										{t("officialStaff.category.video")}
									</TabsTrigger>
								</TabsList>
							</Tabs>
							<div className="grid min-h-0 flex-1 gap-4 overflow-hidden md:grid-cols-[minmax(260px,0.42fr)_minmax(0,1fr)]">
								<AllModelsPanel
									category={category}
									detail={detail}
									disabled={!editable}
									modelOptions={
										category === "text"
											? modelOptions
											: modelOptions.filter(
													(model) => model.id !== dynamicModelId,
												)
									}
									onAddModel={handleAddModel}
									onFloatingOpenChange={setOpenFloatingId}
									onCreateGroupForModel={handleCreateGroupForModel}
									openFloatingId={openFloatingId}
								/>

								<div className="flex min-h-0 flex-col gap-4 overflow-hidden pr-1 pt-1">
									<div className="shrink-0 space-y-4">
										{!isDefaultConfig ? (
											<>
												<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
													<div className="min-w-0">
														<div className="font-medium text-foreground">
															{t("officialStaff.assign.method")}
														</div>
														<div className="text-xs text-muted-foreground">
															{t("officialStaff.assign.methodDesc")}
														</div>
													</div>
													<Select
														disabled={
															!canEdit || detail.mode.is_default === 1
														}
														onOpenChange={(selectOpen) =>
															setOpenFloatingId(
																selectOpen
																	? "assign-distribution"
																	: null,
															)
														}
														onValueChange={handleDistributionChange}
														open={
															openFloatingId === "assign-distribution"
														}
														value={String(
															detail.mode.distribution_type,
														)}
													>
														<SelectTrigger
															className="w-fit min-w-36 max-w-full"
															data-testid="platform-official-staff-select-trigger"
														>
															<SelectValue />
														</SelectTrigger>
														<SelectContent data-testid="platform-official-staff-select-content">
															<SelectItem
																data-testid="platform-official-staff-option"
																value={String(
																	staffDistributionType.independent,
																)}
															>
																{t(
																	"officialStaff.assign.customConfig",
																)}
															</SelectItem>
															<SelectItem
																data-testid="platform-official-staff-option"
																value={String(
																	staffDistributionType.follow,
																)}
															>
																{t(
																	"officialStaff.assign.followOther",
																)}
															</SelectItem>
														</SelectContent>
													</Select>
												</div>
												<Separator />
											</>
										) : null}
										<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
											<div className="min-w-0">
												<div className="font-medium text-foreground">
													{isFollow
														? t("officialStaff.assign.followStaff")
														: t("officialStaff.assign.availableModels")}
												</div>
												<div className="text-xs text-muted-foreground">
													{isFollow
														? t("officialStaff.assign.followStaffDesc")
														: t(
																"officialStaff.assign.availableModelsDesc",
															)}
												</div>
											</div>
											{isFollow ? (
												<Select
													disabled={!canEdit}
													onOpenChange={(selectOpen) =>
														setOpenFloatingId(
															selectOpen
																? "assign-follow-staff"
																: null,
														)
													}
													onValueChange={handleFollowModeChange}
													open={openFloatingId === "assign-follow-staff"}
													value={detail.mode.follow_mode_id || ""}
												>
													<SelectTrigger
														className="w-fit min-w-40 max-w-full"
														data-testid="platform-official-staff-select-trigger"
													>
														<SelectValue
															placeholder={t(
																"officialStaff.placeholder.selectStaff",
															)}
														/>
													</SelectTrigger>
													<SelectContent data-testid="platform-official-staff-select-content">
														{modeOptions
															.filter(
																(item) =>
																	item.id &&
																	item.id !== staff?.id,
															)
															.map((item) => (
																<SelectItem
																	data-testid="platform-official-staff-option"
																	key={item.id}
																	value={item.id}
																>
																	{getI18nText(
																		item.name_i18n,
																		language,
																	)}
																</SelectItem>
															))}
													</SelectContent>
												</Select>
											) : (
												<div className="flex items-center gap-2">
													{canEdit && detail.mode.is_default !== 1 ? (
														<Button
															data-testid="platform-official-staff-confirm-button"
															onClick={() =>
																setConfirmAction({ kind: "reset" })
															}
															variant="outline"
														>
															<RotateCcw className="size-4" />
															{t("officialStaff.action.resetDefault")}
														</Button>
													) : null}
													{editable ? (
														<Button
															data-testid="platform-official-staff-create-button"
															onClick={() =>
																setGroupDialog({
																	group: null,
																	open: true,
																})
															}
														>
															<Plus className="size-4" />
															{t("officialStaff.action.createGroup")}
														</Button>
													) : null}
												</div>
											)}
										</div>
									</div>

									<div className="min-h-0 overflow-y-auto pr-1">
										<div className="space-y-3">
											{detail.groups.length === 0 ? (
												<EmptyState
													description={t(
														"officialStaff.assign.emptyDescription",
													)}
													icon={Boxes}
													title={t("officialStaff.assign.emptyTitle")}
													testId="platform-official-staff-empty"
												/>
											) : (
												<SortableContext
													items={detail.groups.map(
														(entry) => entry.group.id,
													)}
													strategy={verticalListSortingStrategy}
												>
													{detail.groups.map((entry) => (
														<ModelGroupCard
															activeDragData={activeDragData}
															editable={editable}
															dropIndicator={dropIndicator}
															entry={entry}
															category={category}
															key={entry.group.id}
															onChange={setDetail}
															onEditGroup={(group) => {
																setOpenFloatingId(null)
																setGroupDialog({
																	group,
																	open: true,
																})
															}}
															onFloatingOpenChange={setOpenFloatingId}
															onRequestDelete={setConfirmAction}
															openFloatingId={openFloatingId}
														/>
													))}
												</SortableContext>
											)}
										</div>
									</div>
								</div>
							</div>
						</div>
						{createPortal(
							<PortalThemeScope>
								<DragOverlay dropAnimation={null} zIndex={80}>
									<DragPreviewItem
										meta={getActivePreviewMeta(activeDragData, language, t)}
									/>
								</DragOverlay>
							</PortalThemeScope>,
							document.body,
						)}
					</DndContext>
				)}
				<DialogFooter>
					<Button
						data-testid="platform-official-staff-cancel-button"
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						{t("common.cancel")}
					</Button>
					<Button
						data-testid="platform-official-staff-save-button"
						disabled={!canEdit || !detail || saveConfigPending}
						onClick={handleSave}
					>
						{saveConfigPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Save className="size-4" />
						)}
						{t("common.save")}
					</Button>
				</DialogFooter>

				{canEdit ? (
					<>
						<GroupFormDialog
							canEdit={canEdit}
							category={category}
							detail={detail}
							pendingModel={newGroupPendingModel}
							onChange={setDetail}
							onOpenChange={(dialogOpen) => {
								setGroupDialog((prev) => ({ ...prev, open: dialogOpen }))
								if (!dialogOpen) setNewGroupPendingModel(null)
							}}
							open={groupDialog.open}
							targetGroup={groupDialog.group}
						/>
						<DeleteConfirmDialog
							contentTestId="platform-official-staff-model-delete-dialog-content"
							cancelButtonTestId="platform-official-staff-model-delete-cancel-button"
							confirmButtonTestId="platform-official-staff-model-delete-confirm-button"
							confirmDisabled={!canEdit}
							confirmIcon={
								confirmAction?.kind === "reset" ? (
									<RotateCcw className="size-4" aria-hidden="true" />
								) : undefined
							}
							confirmLabel={
								confirmAction?.kind === "reset"
									? t("officialStaff.action.confirmReset")
									: undefined
							}
							description={confirmDescription}
							isPending={
								confirmAction?.kind === "group"
									? deleteGroupPending
									: confirmAction?.kind === "reset"
										? defaultDetailPending
										: false
							}
							onConfirm={handleConfirmAction}
							onOpenChange={(nextOpen) => !nextOpen && setConfirmAction(null)}
							open={Boolean(confirmAction)}
							title={confirmTitle}
						/>
					</>
				) : null}
			</DialogContent>
		</Dialog>
	)
}

function AssignDialogSkeleton() {
	return (
		<div
			className="grid min-h-0 gap-4 py-2 md:grid-cols-[minmax(260px,0.42fr)_minmax(0,1fr)]"
			data-testid="platform-official-staff-assignment-loading"
		>
			<div className="flex min-h-[420px] min-w-0 flex-col gap-3 overflow-hidden rounded-lg border bg-card p-4">
				<div className="shrink-0 space-y-2">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-3 w-48 max-w-full" />
				</div>
				<Skeleton className="h-9 w-full shrink-0" />
				<div className="min-h-0 flex-1 space-y-2 overflow-hidden rounded-lg border p-2">
					{Array.from({ length: 6 }, (_, index) => (
						<div className="flex items-center gap-2 rounded-md px-1 py-1.5" key={index}>
							<Skeleton className="size-5 shrink-0 rounded" />
							<Skeleton className="size-6 shrink-0 rounded-full" />
							<div className="min-w-0 flex-1 space-y-1.5">
								<Skeleton className="h-3 w-3/4" />
								<Skeleton className="h-2.5 w-1/2" />
							</div>
							<Skeleton className="size-7 shrink-0 rounded-md" />
						</div>
					))}
				</div>
			</div>

			<div className="flex min-h-[420px] min-w-0 flex-col gap-4 overflow-hidden">
				<div className="shrink-0 space-y-4 rounded-lg border bg-card p-4">
					<div className="flex items-center justify-between gap-4">
						<div className="min-w-0 flex-1 space-y-2">
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-3 w-64 max-w-full" />
						</div>
						<Skeleton className="h-9 w-32 shrink-0" />
					</div>
					<div className="h-px bg-border" />
					<div className="flex items-center justify-between gap-4">
						<div className="min-w-0 flex-1 space-y-2">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-3 w-56 max-w-full" />
						</div>
						<div className="flex shrink-0 gap-2">
							<Skeleton className="h-9 w-24" />
							<Skeleton className="h-9 w-28" />
						</div>
					</div>
				</div>
				<div className="min-h-0 flex-1 space-y-3 overflow-hidden pr-1">
					{Array.from({ length: 3 }, (_, index) => (
						<div className="space-y-3 rounded-lg border bg-card p-3" key={index}>
							<div className="flex items-center justify-between gap-3">
								<div className="flex min-w-0 items-center gap-2">
									<Skeleton className="size-5 shrink-0 rounded-full" />
									<Skeleton className="h-4 w-28" />
									<Skeleton className="h-3 w-16" />
								</div>
								<Skeleton className="size-7 shrink-0 rounded-md" />
							</div>
							<div className="space-y-2">
								<div className="flex items-center gap-2 rounded-lg border p-2">
									<Skeleton className="size-5 shrink-0 rounded" />
									<Skeleton className="size-6 shrink-0 rounded-full" />
									<Skeleton className="h-3 w-40 max-w-[55%]" />
									<Skeleton className="ml-auto size-7 shrink-0 rounded-md" />
								</div>
								<div className="flex items-center gap-2 rounded-lg border p-2">
									<Skeleton className="size-5 shrink-0 rounded" />
									<Skeleton className="size-6 shrink-0 rounded-full" />
									<Skeleton className="h-3 w-32 max-w-[45%]" />
									<Skeleton className="ml-auto size-7 shrink-0 rounded-md" />
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
