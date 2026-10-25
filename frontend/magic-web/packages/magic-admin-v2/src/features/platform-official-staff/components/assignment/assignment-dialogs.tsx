import { zodResolver } from "@hookform/resolvers/zod"
import { GripVertical, Loader2, Save, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useForm, type FieldErrors } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { FieldError } from "@magic-admin-v2/components/form/field-error"
import { Button } from "@magic-admin-v2/components/ui/button"
import { Badge } from "@magic-admin-v2/components/ui/badge"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@magic-admin-v2/components/ui/dialog"
import { Input } from "@magic-admin-v2/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs"
import { Textarea } from "@magic-admin-v2/components/ui/textarea"
import { StaffIconUploadField } from "@magic-admin-v2/features/platform-official-staff/components/staff-icon-upload-field"
import { ModelAvatar } from "@magic-admin-v2/features/platform-official-staff/components/avatars"
import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field"
import { useSaveOfficialStaffGroupMutation } from "@magic-admin-v2/features/platform-official-staff/mutations"
import {
	createBaseModel,
	createDynamicModel,
	dynamicModelId,
	normalizeErrorMessage,
	staffDragType,
	type DynamicModelLocale,
	type NewGroupPendingModel,
	type StaffDragData,
} from "@magic-admin-v2/features/platform-official-staff/utils/page-utils"
import {
	staffModelStatus,
	type OfficialStaffDetail,
	type OfficialStaffGroup,
	type StaffBaseModel,
	type StaffDynamicModel,
	type StaffModelCategory,
	type StaffModelItem,
} from "@magic-admin-v2/features/platform-official-staff/types"
import { Language } from "@magic-admin-v2/i18n/resources"
import { useTranslation } from "react-i18next"

export function DynamicModelEditDialog({
	canEdit,
	model,
	onOpenChange,
	onSave,
	open,
}: {
	canEdit: boolean
	model: StaffDynamicModel
	onOpenChange: (open: boolean) => void
	onSave: (model: StaffModelItem) => void
	open: boolean
}) {
	const { t } = useTranslation()
	const [activeLocale, setActiveLocale] = useState<DynamicModelLocale>(Language.ZhCN)
	const [isIconUploading, setIsIconUploading] = useState(false)
	const hasLockedModelId = Boolean(model.model_id?.trim())
	const schema = useMemo(
		() =>
			z.object({
				descriptionEn: z.string(),
				descriptionZh: z.string(),
				modelIcon: z.string(),
				modelId: z.string(),
				nameEn: z
					.string()
					.trim()
					.min(1, t("officialStaff.validation.dynamicModelNameEnRequired")),
				nameZh: z
					.string()
					.trim()
					.min(1, t("officialStaff.validation.dynamicModelNameZhRequired")),
			}),
		[t],
	)
	type DynamicModelFormValues = z.infer<typeof schema>
	const form = useForm<DynamicModelFormValues>({
		defaultValues: {
			descriptionEn: "",
			descriptionZh: "",
			modelIcon: "",
			modelId: "",
			nameEn: "",
			nameZh: "",
		},
		resolver: zodResolver(schema),
	})
	const nameZh = form.watch("nameZh")
	const nameEn = form.watch("nameEn")
	const descriptionZh = form.watch("descriptionZh")
	const descriptionEn = form.watch("descriptionEn")
	const modelIcon = form.watch("modelIcon")
	const modelId = form.watch("modelId")
	const localeCompletion: Record<DynamicModelLocale, boolean> = {
		zh_CN: Boolean(nameZh.trim() && descriptionZh.trim()),
		en_US: Boolean(nameEn.trim() && descriptionEn.trim()),
	}

	useEffect(() => {
		if (!open) return
		setActiveLocale(Language.ZhCN)
		form.reset({
			descriptionEn: model.model_translate.description?.en_US || "",
			descriptionZh:
				model.model_translate.description?.zh_CN || model.model_description || "",
			modelIcon: model.model_icon || "",
			modelId: model.model_id || "",
			nameEn: model.model_translate.name?.en_US || "",
			nameZh: model.model_translate.name?.zh_CN || model.model_name || "",
		})
		setIsIconUploading(false)
	}, [form, model, open])

	const handleSave = (values: DynamicModelFormValues) => {
		if (!canEdit || isIconUploading) return

		onSave({
			...model,
			model_description: values.descriptionZh.trim(),
			model_id: values.modelId.trim(),
			model_icon: values.modelIcon.trim(),
			model_name: values.nameZh,
			model_translate: {
				...model.model_translate,
				description: {
					zh_CN: values.descriptionZh.trim(),
					en_US: values.descriptionEn.trim(),
				},
				name: {
					zh_CN: values.nameZh,
					en_US: values.nameEn,
				},
			},
		})
		toast.success(t("officialStaff.message.dynamicModelUpdated"))
		onOpenChange(false)
	}

	const handleInvalid = (errors: FieldErrors<DynamicModelFormValues>) => {
		if (activeLocale === Language.ZhCN && errors.nameZh) return
		if (activeLocale === Language.EnUS && errors.nameEn) return
		setActiveLocale(errors.nameZh ? Language.ZhCN : Language.EnUS)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden sm:max-w-lg" data-testid="platform-official-staff-dialog-content" closeButtonTestId="assignment-dialogs-close-button">
				<DialogHeader className="shrink-0">
					<DialogTitle>{t("officialStaff.dialog.editDynamicModelTitle")}</DialogTitle>
					<DialogDescription>
						{t("officialStaff.dialog.dynamicModelDescription")}
					</DialogDescription>
				</DialogHeader>
				<form
					className="flex min-h-0 flex-1 flex-col"
					noValidate
					onSubmit={form.handleSubmit(handleSave, handleInvalid)}
				>
				<div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 py-1">
					<Tabs
						className="grid"
						onValueChange={(value) => setActiveLocale(value as DynamicModelLocale)}
						value={activeLocale}
					>
						<div className="flex h-11 flex-wrap items-center gap-3">
							<span className="shrink-0 text-sm font-medium text-muted-foreground">
								{t("officialStaff.language")}
							</span>
							<TabsList className="h-11 shrink-0">
								{([Language.ZhCN, Language.EnUS] as const).map((locale) => (
									<TabsTrigger className="h-11 gap-2" key={locale} value={locale} data-testid="platform-official-staff-tab-trigger">
										<span>
											{locale === Language.ZhCN
												? t("language.zhCN")
												: t("language.enUS")}
										</span>
										<Badge
											className="h-5 px-1.5 text-[11px] leading-none shadow-none"
											variant="secondary"
										>
											{localeCompletion[locale]
												? t("officialStaff.contentLanguage.complete")
												: t("officialStaff.contentLanguage.incomplete")}
										</Badge>
									</TabsTrigger>
								))}
							</TabsList>
						</div>
						<TabsContent
							className="!mt-4 grid gap-4 data-[state=inactive]:hidden"
							forceMount
							value={Language.ZhCN}
						>
							<DialogFormField
								fieldId="official-staff-model-name-zh"
								label={t("officialStaff.field.modelName")}
								required
							>
								<Input
									aria-invalid={Boolean(form.formState.errors.nameZh)}
									data-testid="platform-official-staff-official-staff-model-name-zh-input"
									id="official-staff-model-name-zh"
									{...form.register("nameZh")}/>
								<FieldError message={form.formState.errors.nameZh?.message} />
							</DialogFormField>
							<DialogFormField
								fieldId="official-staff-model-description-zh"
								label={t("officialStaff.field.modelDescription")}
							>
								<Textarea
									data-testid="platform-official-staff-official-staff-model-description-zh-input"
									id="official-staff-model-description-zh"
									rows={4}
									{...form.register("descriptionZh")}/>
							</DialogFormField>
							<DialogFormField
								description={t("officialStaff.fieldDesc.modelIdentifier")}
								descriptionMode="text"
								fieldId="official-staff-model-identifier-zh"
								label={t("officialStaff.field.modelIdentifier")}
							>
								<Input
									data-testid="platform-official-staff-official-staff-model-identifier-zh-input"
									id="official-staff-model-identifier-zh"
									disabled={hasLockedModelId}
									onChange={(event) =>
										form.setValue("modelId", event.target.value)
									}
									placeholder={t("officialStaff.placeholder.modelIdentifier")}
									value={modelId}/>
							</DialogFormField>
						</TabsContent>
						<TabsContent
							className="!mt-4 grid gap-4 data-[state=inactive]:hidden"
							forceMount
							value={Language.EnUS}
						>
							<DialogFormField
								fieldId="official-staff-model-name-en"
								label={t("officialStaff.field.modelName")}
								required
							>
								<Input
									aria-invalid={Boolean(form.formState.errors.nameEn)}
									data-testid="platform-official-staff-official-staff-model-name-en-input"
									id="official-staff-model-name-en"
									{...form.register("nameEn")}/>
								<FieldError message={form.formState.errors.nameEn?.message} />
							</DialogFormField>
							<DialogFormField
								fieldId="official-staff-model-description-en"
								label={t("officialStaff.field.modelDescription")}
							>
								<Textarea
									data-testid="platform-official-staff-official-staff-model-description-en-input"
									id="official-staff-model-description-en"
									rows={4}
									{...form.register("descriptionEn")}/>
							</DialogFormField>
							<DialogFormField
								description={t("officialStaff.fieldDesc.modelIdentifier")}
								descriptionMode="text"
								fieldId="official-staff-model-identifier-en"
								label={t("officialStaff.field.modelIdentifier")}
							>
								<Input
									data-testid="platform-official-staff-official-staff-model-identifier-en-input"
									id="official-staff-model-identifier-en"
									disabled={hasLockedModelId}
									onChange={(event) =>
										form.setValue("modelId", event.target.value)
									}
									placeholder={t("officialStaff.placeholder.modelIdentifier")}
									value={modelId}/>
							</DialogFormField>
						</TabsContent>
					</Tabs>
					<DialogFormField
						fieldId="official-staff-model-icon"
						label={t("officialStaff.field.icon")}
					>
						<StaffIconUploadField
							disabled={!canEdit}
							id="official-staff-model-icon"
							name={nameZh || model.model_name}
							onUploadingChange={setIsIconUploading}
							onUploaded={(value) => form.setValue("modelIcon", value)}
							value={modelIcon}
						/>
					</DialogFormField>
				</div>
				<DialogFooter className="shrink-0">
					<Button onClick={() => onOpenChange(false)} variant="outline" data-testid="platform-official-staff-cancel-button">
						{t("common.cancel")}
					</Button>
					<Button disabled={!canEdit || isIconUploading} type="submit" data-testid="platform-official-staff-save-button">
						<Save className="size-4" />
						{t("common.save")}
					</Button>
				</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}

export function SubModelRow({
	category,
	dynamicId,
	editable,
	onDelete,
	parentGroupId,
	subModel,
}: {
	category: StaffModelCategory
	dynamicId: string
	editable: boolean
	onDelete: (modelId: string) => void
	parentGroupId: string
	subModel: StaffBaseModel
}) {
	const { t } = useTranslation()
	const deleted = subModel.model_status === staffModelStatus.deleted
	const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
		data: {
			category,
			dynamicId,
			groupId: parentGroupId,
			item: subModel,
			type: staffDragType.subModel,
		} satisfies StaffDragData,
		disabled: !editable || deleted,
		id: `${dynamicId}:${subModel.id}`,
	})
	const style: CSSProperties = {
		opacity: isDragging ? 0.4 : undefined,
		transform: CSS.Transform.toString(transform),
		transition,
	}

	return (
		<div
			className="flex items-center justify-between gap-2 rounded-md border bg-background p-1.5"
			ref={setNodeRef}
			style={style}
		>
			<div className="flex min-w-0 items-center gap-2">
				{editable && !deleted ? (
					<button data-testid="platform-official-staff-assignment-action-button"
						aria-label={t("officialStaff.aria.dragSubModel")}
						className="flex size-4 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
						type="button"
						{...attributes}
						{...listeners}
					>
						<GripVertical className="size-3" />
					</button>
				) : null}
				<ModelAvatar item={subModel} />
				<div className="flex min-w-0 items-center gap-2">
					<div className="truncate text-xs font-medium">{subModel.model_name}</div>
					<div className="truncate font-mono text-[11px] text-muted-foreground">
						{subModel.model_id}
					</div>
					{deleted ? (
						<span className="shrink-0 text-[11px] text-destructive">
							{t("officialStaff.model.deleted")}
						</span>
					) : null}
				</div>
			</div>
			{editable ? (
				<Button
					className="size-6"
					data-testid="platform-official-staff-delete-button"
					onClick={() => onDelete(subModel.id)}
					size="icon"
					variant="ghost">
					<Trash2 className="size-3.5" />
				</Button>
			) : null}
		</div>
	)
}

export function GroupFormDialog({
	canEdit,
	category,
	detail,
	onChange,
	onOpenChange,
	open,
	pendingModel,
	targetGroup,
}: {
	category: StaffModelCategory
	canEdit: boolean
	detail: OfficialStaffDetail | null
	onChange: (detail: OfficialStaffDetail) => void
	onOpenChange: (open: boolean) => void
	open: boolean
	pendingModel: NewGroupPendingModel
	targetGroup: OfficialStaffGroup | null
}) {
	const { t } = useTranslation()
	const [groupIcon, setGroupIcon] = useState("")
	const [isIconUploading, setIsIconUploading] = useState(false)
	const saveGroupMutation = useSaveOfficialStaffGroupMutation()
	const schema = useMemo(
		() =>
			z.object({
				nameEn: z.string().trim().min(1, t("officialStaff.validation.groupNameEnRequired")),
				nameZh: z.string().trim().min(1, t("officialStaff.validation.groupNameZhRequired")),
			}),
		[t],
	)
	const form = useForm<{ nameEn: string; nameZh: string }>({
		defaultValues: { nameEn: "", nameZh: "" },
		resolver: zodResolver(schema),
	})
	const nameEn = form.watch("nameEn")
	const nameZh = form.watch("nameZh")

	useEffect(() => {
		if (!open) return
		form.reset({
			nameEn: targetGroup?.name_i18n.en_US || targetGroup?.name_i18n.default || "",
			nameZh: targetGroup?.name_i18n.zh_CN || targetGroup?.name_i18n.default || "",
		})
		setGroupIcon(targetGroup?.icon || "")
		setIsIconUploading(false)
	}, [form, open, targetGroup])

	const handleSave = async (values: { nameEn: string; nameZh: string }) => {
		if (!canEdit || !detail || isIconUploading) return
		try {
			const savedGroup = await saveGroupMutation.mutateAsync({
				icon: groupIcon.trim(),
				id: targetGroup?.id,
				mode_id: detail.mode.id,
				name_i18n: {
					zh_CN: values.nameZh,
					en_US: values.nameEn,
				},
			})
			onChange({
				...detail,
				groups: targetGroup
					? detail.groups.map((entry) =>
							entry.group.id === targetGroup.id
								? { ...entry, group: savedGroup }
								: entry,
						)
					: [
							...detail.groups,
							{
								group: savedGroup,
								text_models:
									category === "text" && pendingModel
										? [
												pendingModel.id === dynamicModelId
													? createDynamicModel(savedGroup.id, 0)
													: createBaseModel(
															pendingModel,
															savedGroup.id,
															0,
														),
											]
										: [],
								image_models:
									category === "image" && pendingModel
										? [createBaseModel(pendingModel, savedGroup.id, 0)]
										: [],
								video_models:
									category === "video" && pendingModel
										? [createBaseModel(pendingModel, savedGroup.id, 0)]
										: [],
							},
						],
			})
			toast.success(
				targetGroup
					? t("officialStaff.message.groupUpdated")
					: pendingModel
						? t("officialStaff.message.groupCreatedWithModel")
						: t("officialStaff.message.groupCreated"),
			)
			onOpenChange(false)
		} catch (error) {
			toast.error(
				normalizeErrorMessage(
					error,
					targetGroup
						? t("officialStaff.error.groupUpdateFailed")
						: t("officialStaff.error.groupCreateFailed"),
				),
			)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden sm:max-w-xl" data-testid="platform-official-staff-dialog-content" closeButtonTestId="assignment-dialogs-close-button">
				<DialogHeader className="shrink-0">
					<DialogTitle>
						{targetGroup
							? t("officialStaff.dialog.editGroupTitle")
							: t("officialStaff.dialog.createGroupTitle")}
					</DialogTitle>
					<DialogDescription>
						{t("officialStaff.dialog.groupDescription")}
					</DialogDescription>
				</DialogHeader>
				<form
					className="flex min-h-0 flex-1 flex-col gap-4"
					noValidate
					onSubmit={form.handleSubmit(handleSave)}
				>
					<div className="-mx-1 grid min-h-0 flex-1 gap-4 overflow-y-auto px-1 py-1">
						<DialogFormField
							fieldId="official-staff-group-name-zh"
							label={t("officialStaff.field.nameZh")}
							required
						>
							<Input
								aria-invalid={Boolean(form.formState.errors.nameZh)}
								data-testid="platform-official-staff-official-staff-group-name-zh-input"
								disabled={!canEdit}
								id="official-staff-group-name-zh"
								{...form.register("nameZh")}/>
							<FieldError message={form.formState.errors.nameZh?.message} />
						</DialogFormField>
						<DialogFormField
							fieldId="official-staff-group-name-en"
							label={t("officialStaff.field.nameEn")}
							required
						>
							<Input
								aria-invalid={Boolean(form.formState.errors.nameEn)}
								data-testid="platform-official-staff-official-staff-group-name-en-input"
								disabled={!canEdit}
								id="official-staff-group-name-en"
								{...form.register("nameEn")}/>
							<FieldError message={form.formState.errors.nameEn?.message} />
						</DialogFormField>
						<DialogFormField
							fieldId="official-staff-group-icon"
							label={t("officialStaff.field.icon")}
						>
							<StaffIconUploadField
								disabled={!canEdit || saveGroupMutation.isPending}
								id="official-staff-group-icon"
								name={nameZh || nameEn}
								onUploadingChange={setIsIconUploading}
								onUploaded={setGroupIcon}
								value={groupIcon}
							/>
						</DialogFormField>
					</div>
					<DialogFooter className="shrink-0">
						<Button onClick={() => onOpenChange(false)} type="button" variant="outline" data-testid="platform-official-staff-cancel-button">
							{t("common.cancel")}
						</Button>
						<Button
							data-testid="platform-official-staff-save-button"
							disabled={!canEdit || isIconUploading || saveGroupMutation.isPending}
							type="submit">
							{saveGroupMutation.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Save className="size-4" />
							)}
							{t("common.save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
