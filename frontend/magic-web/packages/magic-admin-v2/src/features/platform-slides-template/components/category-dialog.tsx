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
import { Switch } from "@magic-admin-v2/components/ui/switch"
import type { useSlidesTemplateCategoryMutations } from "@magic-admin-v2/features/platform-slides-template/mutations"
import {
	slidesTemplateStatus,
	type SlidesTemplateCategory,
	type SlidesTemplateCategoryFormValues,
} from "@magic-admin-v2/features/platform-slides-template/types"
import {
	SLIDES_TEMPLATE_FIELD_LIMITS,
	buildCategorySaveParams,
} from "@magic-admin-v2/features/platform-slides-template/utils"

type CategoryDialogProps = {
	editing: SlidesTemplateCategory | null
	mutations: ReturnType<typeof useSlidesTemplateCategoryMutations>
	onOpenChange: (open: boolean) => void
	open: boolean
}

export function CategoryDialog({ editing, mutations, onOpenChange, open }: CategoryDialogProps) {
	const { t } = useTranslation()
	const schema = useMemo(
		() =>
			z.object({
				name_en: z
					.string()
					.trim()
					.min(1, t("slidesTemplate.validation.nameEnRequired"))
					.max(
						SLIDES_TEMPLATE_FIELD_LIMITS.name,
						t("slidesTemplate.validation.nameMaxLength"),
					),
				name_zh: z
					.string()
					.trim()
					.min(1, t("slidesTemplate.validation.nameZhRequired"))
					.max(
						SLIDES_TEMPLATE_FIELD_LIMITS.name,
						t("slidesTemplate.validation.nameMaxLength"),
					),
				sort: z
					.number()
					.finite()
					.int(t("slidesTemplate.validation.sortInteger"))
					.min(0, t("slidesTemplate.validation.sortNonNegative")),
				status: z.boolean(),
			}),
		[t],
	)
	const form = useForm<SlidesTemplateCategoryFormValues>({
		defaultValues: createDefaultValues(editing),
		resolver: zodResolver(schema),
	})
	const isPending = mutations.create.isPending || mutations.update.isPending

	useEffect(() => {
		if (open) form.reset(createDefaultValues(editing))
	}, [editing, form, open])

	const save = async (values: SlidesTemplateCategoryFormValues) => {
		try {
			const data = buildCategorySaveParams(values)
			if (editing) await mutations.update.mutateAsync({ data, id: editing.id })
			else await mutations.create.mutateAsync(data)
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
			<DialogContent data-testid="platform-slides-template-dialog-content" closeButtonTestId="category-dialog-close-button">
				<DialogHeader>
					<DialogTitle>
						{editing
							? t("slidesTemplate.editCategory")
							: t("slidesTemplate.createCategory")}
					</DialogTitle>
					<DialogDescription>
						{t("slidesTemplate.categoryForm.description")}
					</DialogDescription>
				</DialogHeader>
				<form className="grid gap-4" noValidate onSubmit={form.handleSubmit(save)}>
					<DialogFormField
						fieldId="slides-template-category-name-zh"
						label={t("slidesTemplate.form.nameZh")}
						required
					>
						<Input
							disabled={isPending}
							id="slides-template-category-name-zh"
							maxLength={SLIDES_TEMPLATE_FIELD_LIMITS.name}
							{...form.register("name_zh")}
						 data-testid="platform-slides-template-slides-template-category-name-zh-input"/>
						<FieldError message={form.formState.errors.name_zh?.message} />
					</DialogFormField>
					<DialogFormField
						fieldId="slides-template-category-name-en"
						label={t("slidesTemplate.form.nameEn")}
						required
					>
						<Input
							disabled={isPending}
							id="slides-template-category-name-en"
							maxLength={SLIDES_TEMPLATE_FIELD_LIMITS.name}
							{...form.register("name_en")}
						 data-testid="platform-slides-template-slides-template-category-name-en-input"/>
						<FieldError message={form.formState.errors.name_en?.message} />
					</DialogFormField>
					<div className="grid grid-cols-2 gap-4">
						<DialogFormField
							fieldId="slides-template-category-sort"
							label={t("slidesTemplate.form.sort")}
						>
							<Input
								disabled={isPending}
								id="slides-template-category-sort"
								min={0}
								{...form.register("sort", {
									setValueAs: (value) => (value === "" ? 0 : Number(value)),
								})}
								type="number"
							 data-testid="platform-slides-template-slides-template-category-sort-input"/>
							<FieldError message={form.formState.errors.sort?.message} />
						</DialogFormField>
						<DialogFormField
							fieldId="slides-template-category-status"
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
											id="slides-template-category-status"
											onCheckedChange={field.onChange}
										 data-testid="platform-slides-template-slides-template-category-status-switch"/>
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
	editing: SlidesTemplateCategory | null,
): SlidesTemplateCategoryFormValues {
	return {
		name_en: editing?.name_i18n.en_US ?? "",
		name_zh: editing?.name_i18n.zh_CN ?? "",
		sort: editing?.sort ?? 0,
		status: editing?.status !== slidesTemplateStatus.disabled,
	}
}
