import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field"
import { FieldError } from "@magic-admin-v2/components/form/field-error"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@magic-admin-v2/components/ui/dialog"
import { Input } from "@magic-admin-v2/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import { Textarea } from "@magic-admin-v2/components/ui/textarea"
import type { useSlidesTemplateTagMutations } from "@magic-admin-v2/features/platform-slides-template/mutations"
import {
	slidesTemplateStatus,
	type SlidesTemplateTag,
	type SlidesTemplateTagFormValues,
} from "@magic-admin-v2/features/platform-slides-template/types"
import {
	SLIDES_TEMPLATE_TAG_CODE_PATTERN,
	SLIDES_TEMPLATE_TAG_GROUP_CODE_PATTERN,
	SLIDES_TEMPLATE_FIELD_LIMITS,
	buildTagSaveParams,
	isSystemSlidesTemplateTagGroup,
	resolveSlidesTemplateTagName,
} from "@magic-admin-v2/features/platform-slides-template/utils"

type TagDialogProps = {
	defaultParentId?: string | null
	editing: SlidesTemplateTag | null
	groups: SlidesTemplateTag[]
	mode: "group" | "tag"
	mutations: ReturnType<typeof useSlidesTemplateTagMutations>
	onCreated?: (record: SlidesTemplateTag) => void
	onOpenChange: (open: boolean) => void
	open: boolean
}

export function TagDialog({
	defaultParentId,
	editing,
	groups,
	mode,
	mutations,
	onCreated,
	onOpenChange,
	open,
}: TagDialogProps) {
	const { t } = useTranslation()
	const codeHint =
		mode === "group"
			? t("slidesTemplate.validation.groupCodeHint")
			: t("slidesTemplate.validation.tagCodeHint")
	const schema = useMemo(() => createTagSchema(mode, t), [mode, t])
	const form = useForm<SlidesTemplateTagFormValues>({
		defaultValues: createDefaultValues(editing, defaultParentId, groups, mode),
		resolver: zodResolver(schema),
	})
	const isPending = mutations.create.isPending || mutations.update.isPending

	useEffect(() => {
		if (open) form.reset(createDefaultValues(editing, defaultParentId, groups, mode))
	}, [defaultParentId, editing, form, groups, mode, open])

	const save = async (values: SlidesTemplateTagFormValues) => {
		try {
			const data = buildTagSaveParams(values)
			if (editing) await mutations.update.mutateAsync({ data, id: editing.id })
			else {
				const created = await mutations.create.mutateAsync(data)
				onCreated?.(created)
			}
			toast.success(t("common.saveSuccess"))
			onOpenChange(false)
		} catch (error) {
			form.setError("root.server", {
				message: (error as { message?: string }).message || t("common.requestFailed"),
			})
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent data-testid="platform-slides-template-dialog-content" closeButtonTestId="tag-dialog-close-button">
				<DialogHeader>
					<DialogTitle>
						{editing
							? mode === "group"
								? t("slidesTemplate.editTagGroup")
								: t("slidesTemplate.editTag")
							: mode === "group"
								? t("slidesTemplate.createTagGroup")
								: t("slidesTemplate.createTag")}
					</DialogTitle>
					<DialogDescription className="sr-only">{codeHint}</DialogDescription>
				</DialogHeader>
				<form className="grid gap-4" noValidate onSubmit={form.handleSubmit(save)}>
					<DialogFormField
						description={codeHint}
						fieldId={`slides-template-${mode}-code`}
						label={t(
							mode === "group"
								? "slidesTemplate.tagGroupCode"
								: "slidesTemplate.tagCode",
						)}
						required
					>
						<Input
							disabled={Boolean(editing && isSystemSlidesTemplateTagGroup(editing))}
							id={`slides-template-${mode}-code`}
							maxLength={SLIDES_TEMPLATE_FIELD_LIMITS.code}
							{...form.register("code")}
						 data-testid="platform-slides-template-input"/>
						<FieldError message={form.formState.errors.code?.message} />
					</DialogFormField>
					{mode === "tag" ? (
						<DialogFormField
							fieldId="slides-template-tag-parent-group"
							label={t("slidesTemplate.parentGroup")}
							required
						>
							<Controller
								control={form.control}
								name="parent_id"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger
											className="w-full"
											id="slides-template-tag-parent-group"
										 data-testid="platform-slides-template-slides-template-tag-parent-group-trigger">
											<SelectValue />
										</SelectTrigger>
										<SelectContent data-testid="platform-slides-template-slides-template-tag-parent-group-content">
											{groups.map((group) => (
												<SelectItem key={group.id} value={String(group.id)} data-testid="platform-slides-template-option">
													{resolveSlidesTemplateTagName(group)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
							<FieldError message={form.formState.errors.parent_id?.message} />
						</DialogFormField>
					) : null}
					<div className="grid gap-4 sm:grid-cols-2">
						<DialogFormField
							fieldId={`slides-template-${mode}-name-zh`}
							label={t("slidesTemplate.form.nameZh")}
							required
						>
							<Input
								disabled={isPending}
								id={`slides-template-${mode}-name-zh`}
								maxLength={SLIDES_TEMPLATE_FIELD_LIMITS.name}
								{...form.register("name_zh")}
							 data-testid="platform-slides-template-input"/>
							<FieldError message={form.formState.errors.name_zh?.message} />
						</DialogFormField>
						<DialogFormField
							fieldId={`slides-template-${mode}-name-en`}
							label={t("slidesTemplate.form.nameEn")}
							required
						>
							<Input
								disabled={isPending}
								id={`slides-template-${mode}-name-en`}
								maxLength={SLIDES_TEMPLATE_FIELD_LIMITS.name}
								{...form.register("name_en")}
							 data-testid="platform-slides-template-input"/>
							<FieldError message={form.formState.errors.name_en?.message} />
						</DialogFormField>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<DialogFormField
							fieldId={`slides-template-${mode}-description-zh`}
							label={t("slidesTemplate.form.descriptionZh")}
						>
							<Textarea
								disabled={isPending}
								id={`slides-template-${mode}-description-zh`}
								maxLength={SLIDES_TEMPLATE_FIELD_LIMITS.description}
								rows={3}
								{...form.register("description_zh")}
							 data-testid="platform-slides-template-textarea-input"/>
							<FieldError message={form.formState.errors.description_zh?.message} />
						</DialogFormField>
						<DialogFormField
							fieldId={`slides-template-${mode}-description-en`}
							label={t("slidesTemplate.form.descriptionEn")}
						>
							<Textarea
								disabled={isPending}
								id={`slides-template-${mode}-description-en`}
								maxLength={SLIDES_TEMPLATE_FIELD_LIMITS.description}
								rows={3}
								{...form.register("description_en")}
							 data-testid="platform-slides-template-textarea-input"/>
							<FieldError message={form.formState.errors.description_en?.message} />
						</DialogFormField>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<DialogFormField
							fieldId={`slides-template-${mode}-sort`}
							label={t("slidesTemplate.form.sort")}
						>
							<Input
								disabled={isPending}
								id={`slides-template-${mode}-sort`}
								min={0}
								{...form.register("sort", {
									setValueAs: (value) => (value === "" ? 0 : Number(value)),
								})}
								type="number"
							 data-testid="platform-slides-template-input"/>
							<FieldError message={form.formState.errors.sort?.message} />
						</DialogFormField>
						<DialogFormField
							fieldId={`slides-template-${mode}-status`}
							label={t("slidesTemplate.form.status")}
						>
							<div className="flex h-9 items-center">
								<Controller
									control={form.control}
									name="status"
									render={({ field }) => (
										<Switch
											checked={field.value}
											disabled={isPending}
											id={`slides-template-${mode}-status`}
											onCheckedChange={field.onChange}
										 data-testid="platform-slides-template-switch"/>
									)}
								/>
							</div>
						</DialogFormField>
					</div>
					<FieldError message={form.formState.errors.root?.server?.message} />
					<DialogFooter>
						<Button onClick={() => onOpenChange(false)} type="button" variant="outline" data-testid="platform-slides-template-cancel-button">
							{t("common.cancel")}
						</Button>
						<Button disabled={isPending} type="submit" data-testid="platform-slides-template-save-button">
							{t("common.save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}

function createDefaultValues(
	editing: SlidesTemplateTag | null,
	defaultParentId: string | null | undefined,
	groups: SlidesTemplateTag[],
	mode: "group" | "tag",
): SlidesTemplateTagFormValues {
	return {
		code: editing?.code ?? "",
		description_en: editing?.description_i18n?.en_US ?? "",
		description_zh: editing?.description_i18n?.zh_CN ?? "",
		name_en: editing?.name_i18n?.en_US ?? "",
		name_zh: editing?.name_i18n?.zh_CN ?? "",
		node_type: mode,
		parent_id: String(editing?.parent_id ?? defaultParentId ?? groups[0]?.id ?? ""),
		sort: editing?.sort ?? 0,
		status: editing?.status !== slidesTemplateStatus.disabled,
	}
}

function createTagSchema(mode: "group" | "tag", t: (key: string) => string) {
	const codePattern =
		mode === "tag" ? SLIDES_TEMPLATE_TAG_CODE_PATTERN : SLIDES_TEMPLATE_TAG_GROUP_CODE_PATTERN
	const codeMessage =
		mode === "tag"
			? t("slidesTemplate.validation.tagCode")
			: t("slidesTemplate.validation.groupCode")

	return z.object({
		code: z
			.string()
			.trim()
			.min(1, t("slidesTemplate.validation.codeRequired"))
			.max(SLIDES_TEMPLATE_FIELD_LIMITS.code, t("slidesTemplate.validation.codeMaxLength"))
			.regex(codePattern, codeMessage),
		description_en: z
			.string()
			.max(
				SLIDES_TEMPLATE_FIELD_LIMITS.description,
				t("slidesTemplate.validation.descriptionMaxLength"),
			),
		description_zh: z
			.string()
			.max(
				SLIDES_TEMPLATE_FIELD_LIMITS.description,
				t("slidesTemplate.validation.descriptionMaxLength"),
			),
		name_en: z
			.string()
			.trim()
			.min(1, t("slidesTemplate.validation.nameEnRequired"))
			.max(SLIDES_TEMPLATE_FIELD_LIMITS.name, t("slidesTemplate.validation.nameMaxLength")),
		name_zh: z
			.string()
			.trim()
			.min(1, t("slidesTemplate.validation.nameZhRequired"))
			.max(SLIDES_TEMPLATE_FIELD_LIMITS.name, t("slidesTemplate.validation.nameMaxLength")),
		node_type: z.literal(mode),
		parent_id:
			mode === "tag"
				? z.string().min(1, t("slidesTemplate.validation.parentGroupRequired"))
				: z.string(),
		sort: z
			.number()
			.finite()
			.int(t("slidesTemplate.validation.sortInteger"))
			.min(0, t("slidesTemplate.validation.sortNonNegative")),
		status: z.boolean(),
	})
}
