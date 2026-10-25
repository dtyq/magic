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
import {
	agentMarketCategoryStatus,
	type AgentMarketCategoryFormValues,
	type AgentMarketCategoryItem,
} from "@magic-admin-v2/features/platform-official-marketplace/types"
import { agentMarketCategoryNameMaxLength } from "@magic-admin-v2/features/platform-official-marketplace/utils"

const defaultValues: AgentMarketCategoryFormValues = {
	nameEn: "",
	nameZh: "",
	sortOrder: 0,
	visible: true,
}

type AgentMarketCategoryFormDialogProps = {
	editing: AgentMarketCategoryItem | null
	isPending: boolean
	onOpenChange: (open: boolean) => void
	onSubmit: (values: AgentMarketCategoryFormValues) => Promise<void>
	open: boolean
}

export function AgentMarketCategoryFormDialog({
	editing,
	isPending,
	onOpenChange,
	onSubmit,
	open,
}: AgentMarketCategoryFormDialogProps) {
	const { t } = useTranslation()
	const schema = useMemo(
		() =>
			z.object({
				nameEn: z
					.string()
					.trim()
					.min(1, t("officialMarketplace.category.form.nameEnRequired"))
					.max(
						agentMarketCategoryNameMaxLength,
						t("officialMarketplace.category.form.nameMaxLength"),
					),
				nameZh: z
					.string()
					.trim()
					.min(1, t("officialMarketplace.category.form.nameZhRequired"))
					.max(
						agentMarketCategoryNameMaxLength,
						t("officialMarketplace.category.form.nameMaxLength"),
					),
				sortOrder: z
					.number({ error: t("officialMarketplace.category.form.sortInvalid") })
					.int(t("officialMarketplace.category.form.sortInteger"))
					.min(0, t("officialMarketplace.category.form.sortNonNegative")),
				visible: z.boolean(),
			}),
		[t],
	)
	const form = useForm<AgentMarketCategoryFormValues>({
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
				? (editing.status ?? agentMarketCategoryStatus.visible) ===
					agentMarketCategoryStatus.visible
				: true,
		})
	}, [editing, form, open])

	async function handleSubmit(values: AgentMarketCategoryFormValues) {
		try {
			await onSubmit(values)
		} catch {
			// The owner displays the API error and keeps the form open for correction.
		}
	}

	return (
		<Dialog
			onOpenChange={(nextOpen) => {
				if (!isPending) onOpenChange(nextOpen)
			}}
			open={open}
		>
			<DialogContent className="sm:max-w-xl" data-testid="platform-official-marketplace-dialog-content" closeButtonTestId="agent-market-category-form-dialog-close-button">
				<DialogHeader>
					<DialogTitle>
						{editing
							? t("officialMarketplace.category.editTitle")
							: t("officialMarketplace.category.createTitle")}
					</DialogTitle>
					<DialogDescription>
						{t("officialMarketplace.category.form.description")}
					</DialogDescription>
				</DialogHeader>

				<form className="grid gap-4" noValidate onSubmit={form.handleSubmit(handleSubmit)}>
					<DialogFormField
						fieldId="market-category-name-zh"
						label={t("officialMarketplace.category.form.nameZh")}
						required
					>
						<Input
							autoFocus
							disabled={isPending}
							id="market-category-name-zh"
							maxLength={agentMarketCategoryNameMaxLength}
							{...form.register("nameZh")}
						 data-testid="platform-official-marketplace-market-category-name-zh-input"/>
						<FieldError message={form.formState.errors.nameZh?.message} />
					</DialogFormField>

					<DialogFormField
						fieldId="market-category-name-en"
						label={t("officialMarketplace.category.form.nameEn")}
						required
					>
						<Input
							disabled={isPending}
							id="market-category-name-en"
							maxLength={agentMarketCategoryNameMaxLength}
							{...form.register("nameEn")}
						 data-testid="platform-official-marketplace-market-category-name-en-input"/>
						<FieldError message={form.formState.errors.nameEn?.message} />
					</DialogFormField>

					<DialogFormField
						fieldId="market-category-sort-order"
						label={t("officialMarketplace.category.form.sortOrder")}
					>
						<Input
							disabled={isPending}
							id="market-category-sort-order"
							min={0}
							{...form.register("sortOrder", {
								setValueAs: (value) => (value === "" ? 0 : Number(value)),
							})}
							type="number"
						 data-testid="platform-official-marketplace-market-category-sort-order-input"/>
						<FieldError message={form.formState.errors.sortOrder?.message} />
					</DialogFormField>

					<DialogFormField
						className="w-fit"
						fieldId="market-category-visible"
						label={t("officialMarketplace.category.form.visible")}
					>
						<Controller
							control={form.control}
							name="visible"
							render={({ field }) => (
								<Switch
									checked={field.value}
									disabled={isPending}
									id="market-category-visible"
									onCheckedChange={field.onChange}
								 data-testid="platform-official-marketplace-market-category-visible-switch"/>
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
