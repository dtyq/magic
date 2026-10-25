import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button } from "@magic-admin-v2/components/ui/button"
import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field"
import { FieldError } from "@magic-admin-v2/components/form/field-error"
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
import type {
	SkillMarketCategoryFormValues,
	SkillMarketCategoryItem,
} from "@magic-admin-v2/features/platform-official-marketplace/types"
import {
	skillMarketCategoryNameMaxLength,
	skillMarketCategoryStatus,
} from "@magic-admin-v2/features/platform-official-marketplace/utils"

const defaultValues: SkillMarketCategoryFormValues = {
	nameEn: "",
	nameZh: "",
	sortOrder: 0,
	visible: true,
}

type SkillMarketCategoryFormDialogProps = {
	editing: SkillMarketCategoryItem | null
	isPending: boolean
	onOpenChange: (open: boolean) => void
	onSubmit: (values: SkillMarketCategoryFormValues) => Promise<void>
	open: boolean
}

export function SkillMarketCategoryFormDialog({
	editing,
	isPending,
	onOpenChange,
	onSubmit,
	open,
}: SkillMarketCategoryFormDialogProps) {
	const { t } = useTranslation()
	const schema = useMemo(
		() =>
			z.object({
				nameEn: z
					.string()
					.trim()
					.min(1, t("officialMarketplace.skillCategory.form.nameEnRequired"))
					.max(
						skillMarketCategoryNameMaxLength,
						t("officialMarketplace.skillCategory.form.nameMaxLength"),
					),
				nameZh: z
					.string()
					.trim()
					.min(1, t("officialMarketplace.skillCategory.form.nameZhRequired"))
					.max(
						skillMarketCategoryNameMaxLength,
						t("officialMarketplace.skillCategory.form.nameMaxLength"),
					),
				sortOrder: z
					.number({ error: t("officialMarketplace.skillCategory.form.sortInvalid") })
					.int(t("officialMarketplace.skillCategory.form.sortInteger"))
					.min(0, t("officialMarketplace.skillCategory.form.sortNonNegative")),
				visible: z.boolean(),
			}),
		[t],
	)
	const form = useForm<SkillMarketCategoryFormValues>({
		defaultValues,
		resolver: zodResolver(schema),
	})

	useEffect(() => {
		if (!open) return
		form.reset({
			nameEn: editing?.name_i18n?.en_US ?? "",
			nameZh: editing?.name_i18n?.zh_CN ?? "",
			sortOrder: editing?.sort_order ?? 0,
			visible: editing
				? (editing.status ?? skillMarketCategoryStatus.visible) ===
					skillMarketCategoryStatus.visible
				: true,
		})
	}, [editing, form, open])

	async function handleSubmit(values: SkillMarketCategoryFormValues) {
		try {
			await onSubmit(values)
		} catch {
			// The manager keeps the dialog open and displays the API error.
		}
	}

	return (
		<Dialog onOpenChange={(nextOpen) => !isPending && onOpenChange(nextOpen)} open={open}>
			<DialogContent className="sm:max-w-xl" data-testid="platform-official-marketplace-dialog-content" closeButtonTestId="skill-market-category-form-dialog-close-button">
				<DialogHeader>
					<DialogTitle>
						{editing
							? t("officialMarketplace.skillCategory.editTitle")
							: t("officialMarketplace.skillCategory.createTitle")}
					</DialogTitle>
					<DialogDescription>
						{t("officialMarketplace.skillCategory.form.description")}
					</DialogDescription>
				</DialogHeader>

				<form className="grid gap-4" noValidate onSubmit={form.handleSubmit(handleSubmit)}>
					<DialogFormField
						fieldId="skill-market-category-name-zh"
						label={t("officialMarketplace.skillCategory.form.nameZh")}
						required
					>
						<Input
							autoFocus
							disabled={isPending}
							id="skill-market-category-name-zh"
							maxLength={skillMarketCategoryNameMaxLength}
							{...form.register("nameZh")}
						 data-testid="platform-official-marketplace-skill-market-category-name-zh-input"/>
						<FieldError message={form.formState.errors.nameZh?.message} />
					</DialogFormField>

					<DialogFormField
						fieldId="skill-market-category-name-en"
						label={t("officialMarketplace.skillCategory.form.nameEn")}
						required
					>
						<Input
							disabled={isPending}
							id="skill-market-category-name-en"
							maxLength={skillMarketCategoryNameMaxLength}
							{...form.register("nameEn")}
						 data-testid="platform-official-marketplace-skill-market-category-name-en-input"/>
						<FieldError message={form.formState.errors.nameEn?.message} />
					</DialogFormField>

					<DialogFormField
						fieldId="skill-market-category-sort-order"
						label={t("officialMarketplace.skillCategory.form.sortOrder")}
					>
						<Input
							disabled={isPending}
							id="skill-market-category-sort-order"
							min={0}
							{...form.register("sortOrder", {
								setValueAs: (value) => (value === "" ? 0 : Number(value)),
							})}
							type="number"
						 data-testid="platform-official-marketplace-skill-market-category-sort-order-input"/>
						<FieldError message={form.formState.errors.sortOrder?.message} />
					</DialogFormField>

					<DialogFormField
						className="w-fit"
						fieldId="skill-market-category-visible"
						label={t("officialMarketplace.skillCategory.form.visible")}
					>
						<Controller
							control={form.control}
							name="visible"
							render={({ field }) => (
								<Switch
									checked={field.value}
									disabled={isPending}
									id="skill-market-category-visible"
									onCheckedChange={field.onChange}
								 data-testid="platform-official-marketplace-skill-market-category-visible-switch"/>
							)}
						/>
					</DialogFormField>

					<DialogFooter>
						<Button
							disabled={isPending}
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						 data-testid="platform-official-marketplace-cancel-button">
							{t("common.cancel")}
						</Button>
						<Button disabled={isPending} type="submit" data-testid="platform-official-marketplace-save-button">
							{isPending ? (
								<Loader2 className="size-4 animate-spin" aria-hidden="true" />
							) : null}
							{t("common.save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
