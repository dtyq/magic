import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Save } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
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
import { Skeleton } from "@magic-admin-v2/components/ui/skeleton"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import {
	createEmptyAppMenuFormState,
	toAppMenuFormState,
} from "@magic-admin-v2/features/platform-app-menu/api"
import {
	NumberSelect,
	RadioChoiceGroup,
} from "@magic-admin-v2/features/platform-app-menu/components/app-menu-form-controls"
import { AppMenuIconPicker } from "@magic-admin-v2/features/platform-app-menu/components/app-menu-icon-picker"
import { AppMenuImageUploadField } from "@magic-admin-v2/features/platform-app-menu/components/app-menu-image-upload-field"
import { isValidAppMenuImageUrl } from "@magic-admin-v2/features/platform-app-menu/utils"
import {
	appMenuDisplayScope,
	appMenuIconType,
	appMenuOpenMethod,
	type AppMenuDisplayScope,
	type AppMenuFormState,
	type AppMenuIconType,
	type AppMenuItem,
	type AppMenuOpenMethod,
} from "@magic-admin-v2/features/platform-app-menu/types"

const formSetValueOptions = {
	shouldDirty: true,
	shouldTouch: true,
	shouldValidate: true,
} as const

interface PlatformAppMenuFormDialogProps {
	/** 列表记录兜底值，详情请求尚未完成时用于保持编辑态。 */
	fallbackItem: AppMenuItem | null
	/** 详情接口返回的完整表单记录。 */
	formItem: AppMenuItem | null
	isDetailLoading: boolean
	isOpen: boolean
	isSaving: boolean
	onClose: () => void
	onSave: (values: AppMenuFormState) => void
}

export function PlatformAppMenuFormDialog({
	fallbackItem,
	formItem,
	isDetailLoading,
	isOpen,
	isSaving,
	onClose,
	onSave,
}: PlatformAppMenuFormDialogProps) {
	const { t } = useTranslation()
	const schema = useMemo(() => createAppMenuSchema(t), [t])
	const form = useForm<AppMenuFormState>({
		defaultValues: createEmptyAppMenuFormState(),
		resolver: zodResolver(schema),
	})
	const [isImageUploading, setIsImageUploading] = useState(false)
	const iconType = form.watch("icon_type")
	const selectedIcon = form.watch("icon")

	useEffect(() => {
		if (!isOpen) return

		if (formItem) {
			form.reset(toAppMenuFormState(formItem))
			return
		}

		if (!fallbackItem) form.reset(createEmptyAppMenuFormState())
	}, [fallbackItem, form, formItem, isOpen])

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				data-testid="platform-app-menu-dialog-content"
				closeButtonTestId="platform-app-menu-form-dialog-close-button"
				className="max-h-[calc(100vh-2rem)] overflow-visible sm:max-w-2xl"
			>
				<DialogHeader>
					<DialogTitle>
						{formItem || fallbackItem
							? t("appMenu.form.editTitle")
							: t("appMenu.form.createTitle")}
					</DialogTitle>
					<DialogDescription>{t("appMenu.form.description")}</DialogDescription>
				</DialogHeader>

				{isDetailLoading ? (
					<AppMenuFormSkeleton />
				) : (
					<form
						className="grid gap-4"
						id="app-menu-form"
						onSubmit={form.handleSubmit((values) => {
							if (!isImageUploading) onSave(values)
						})}
					>
						<div className="grid gap-4 sm:grid-cols-2">
							<DialogFormField
								description={t("appMenu.fieldDesc.nameZh")}
								fieldId="platform-app-menu-name-zh"
								label={t("appMenu.field.nameZh")}
								required
							>
								<Input
									disabled={isSaving}
									id="platform-app-menu-name-zh"
									data-testid="platform-app-menu-platform-app-menu-name-zh-input"
									placeholder={t("appMenu.placeholder.nameZh")}
									{...form.register("name_i18n.zh_CN")}
								/>
								<FieldError
									message={form.formState.errors.name_i18n?.zh_CN?.message}
								/>
							</DialogFormField>
							<DialogFormField
								description={t("appMenu.fieldDesc.nameEn")}
								fieldId="platform-app-menu-name-en"
								label={t("appMenu.field.nameEn")}
								required
							>
								<Input
									disabled={isSaving}
									id="platform-app-menu-name-en"
									data-testid="platform-app-menu-platform-app-menu-name-en-input"
									placeholder={t("appMenu.placeholder.nameEn")}
									{...form.register("name_i18n.en_US")}
								/>
								<FieldError
									message={form.formState.errors.name_i18n?.en_US?.message}
								/>
							</DialogFormField>
						</div>

						<DialogFormField
							description={t("appMenu.fieldDesc.path")}
							fieldId="platform-app-menu-path"
							label={t("appMenu.field.path")}
							required
						>
							<Input
								disabled={isSaving}
								id="platform-app-menu-path"
								data-testid="platform-app-menu-platform-app-menu-path-input"
								placeholder={t("appMenu.placeholder.path")}
								{...form.register("path")}
							/>
							<FieldError message={form.formState.errors.path?.message} />
						</DialogFormField>

						<div className="grid gap-4 sm:grid-cols-2">
							<DialogFormField
								description={t("appMenu.fieldDesc.openMethod")}
								fieldId="platform-app-menu-open-method"
								label={t("appMenu.field.openMethod")}
							>
								<NumberSelect
									ariaLabel={t("appMenu.field.openMethod")}
									disabled={isSaving}
									id="platform-app-menu-open-method"
									onChange={(value) =>
										form.setValue(
											"open_method",
											value as AppMenuOpenMethod,
											formSetValueOptions,
										)
									}
									options={[
										[appMenuOpenMethod.self, t("appMenu.openMethod.self")],
										[appMenuOpenMethod.blank, t("appMenu.openMethod.blank")],
									]}
									value={form.watch("open_method")}
								/>
							</DialogFormField>
							<DialogFormField
								description={t("appMenu.fieldDesc.sortOrder")}
								fieldId="platform-app-menu-sort-order"
								label={t("appMenu.field.sortOrder")}
							>
								<Input
									disabled={isSaving}
									id="platform-app-menu-sort-order"
									data-testid="platform-app-menu-platform-app-menu-sort-order-input"
									min={0}
									placeholder={t("appMenu.placeholder.sortOrder")}
									type="number"
									{...form.register("sort_order", { valueAsNumber: true })}
								/>
								<FieldError message={form.formState.errors.sort_order?.message} />
							</DialogFormField>
						</div>

						<DialogFormField
							description={t("appMenu.fieldDesc.iconType")}
							fieldId="platform-app-menu-icon-type"
							label={t("appMenu.field.iconType")}
						>
							<RadioChoiceGroup
								disabled={isSaving}
								id="platform-app-menu-icon-type"
								onChange={(value) =>
									form.setValue(
										"icon_type",
										Number(value) as AppMenuIconType,
										formSetValueOptions,
									)
								}
								options={[
									{
										value: String(appMenuIconType.icon),
										label: t("appMenu.iconType.icon"),
									},
									{
										value: String(appMenuIconType.image),
										label: t("appMenu.iconType.image"),
									},
								]}
								value={String(iconType)}
							/>
						</DialogFormField>

						{iconType === appMenuIconType.icon ? (
							<DialogFormField
								description={t("appMenu.fieldDesc.icon")}
								fieldId="platform-app-menu-icon"
								label={t("appMenu.field.icon")}
								required
							>
								<AppMenuIconPicker
									disabled={isSaving}
									id="platform-app-menu-icon"
									onChange={(nextIcon) =>
										form.setValue("icon", nextIcon, formSetValueOptions)
									}
									value={selectedIcon}
								/>
								<FieldError message={form.formState.errors.icon?.message} />
							</DialogFormField>
						) : (
							<DialogFormField
								description={t("appMenu.fieldDesc.iconUrl")}
								fieldId="platform-app-menu-icon-url"
								label={t("appMenu.field.iconUrl")}
								required
							>
								<AppMenuImageUploadField
									disabled={isSaving}
									error={form.formState.errors.icon_url?.message}
									id="platform-app-menu-icon-url"
									onUploaded={(nextUrl) =>
										form.setValue("icon_url", nextUrl, formSetValueOptions)
									}
									onUploadingChange={setIsImageUploading}
									value={form.watch("icon_url")}
								/>
							</DialogFormField>
						)}

						<DialogFormField
							description={t("appMenu.fieldDesc.displayScope")}
							fieldId="platform-app-menu-display-scope"
							label={t("appMenu.field.displayScope")}
						>
							<RadioChoiceGroup
								columns={3}
								disabled={isSaving}
								id="platform-app-menu-display-scope"
								onChange={(value) =>
									form.setValue(
										"display_scope",
										Number(value) as AppMenuDisplayScope,
										formSetValueOptions,
									)
								}
								options={[
									{
										value: String(appMenuDisplayScope.all),
										label: t("appMenu.displayScope.all"),
									},
									{
										value: String(appMenuDisplayScope.organization),
										label: t("appMenu.displayScope.organization"),
									},
									{
										value: String(appMenuDisplayScope.personal),
										label: t("appMenu.displayScope.personal"),
									},
								]}
								value={String(form.watch("display_scope"))}
							/>
						</DialogFormField>

						<DialogFormField
							description={t("appMenu.fieldDesc.status")}
							fieldId="platform-app-menu-status"
							label={t("appMenu.field.status")}
						>
							<div className="flex h-9 items-center gap-3">
								<Controller
									control={form.control}
									name="status"
									render={({ field }) => (
										<Switch
											data-testid="platform-app-menu-platform-app-menu-status-switch"
											checked={field.value}
											disabled={isSaving}
											id="platform-app-menu-status"
											onCheckedChange={field.onChange}
										/>
									)}
								/>
								<span className="min-w-8 text-sm text-muted-foreground">
									{form.watch("status")
										? t("appMenu.status.enabled")
										: t("appMenu.status.disabled")}
								</span>
							</div>
						</DialogFormField>

						<DialogFooter className="pt-2">
							<Button
								data-testid="platform-app-menu-cancel-button"
								disabled={isSaving}
								onClick={onClose}
								type="button"
								variant="outline"
							>
								{t("common.cancel")}
							</Button>
							<Button
								data-testid="platform-app-menu-save-button"
								disabled={isSaving || isDetailLoading || isImageUploading}
								type="submit"
							>
								{isSaving ? (
									<Loader2 className="size-4 animate-spin" aria-hidden="true" />
								) : (
									<Save className="size-4" aria-hidden="true" />
								)}
								{isSaving ? t("common.saving") : t("common.save")}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	)
}

function createAppMenuSchema(t: (key: string) => string) {
	return z
		.object({
			name_i18n: z.object({
				zh_CN: z.string().trim().min(1, t("appMenu.validation.nameZhRequired")).max(100),
				en_US: z.string().trim().min(1, t("appMenu.validation.nameEnRequired")).max(100),
			}),
			icon_type: z.union([z.literal(appMenuIconType.icon), z.literal(appMenuIconType.image)]),
			icon: z.string(),
			icon_url: z.string(),
			path: z.string().trim().min(1, t("appMenu.validation.pathRequired")).max(255),
			open_method: z.union([
				z.literal(appMenuOpenMethod.self),
				z.literal(appMenuOpenMethod.blank),
			]),
			sort_order: z.number().int().min(0, t("appMenu.validation.sortOrderMin")),
			display_scope: z.union([
				z.literal(appMenuDisplayScope.organization),
				z.literal(appMenuDisplayScope.personal),
				z.literal(appMenuDisplayScope.all),
			]),
			status: z.boolean(),
		})
		.superRefine((value, context) => {
			if (value.icon_type === appMenuIconType.icon && !value.icon.trim()) {
				context.addIssue({
					code: "custom",
					message: t("appMenu.validation.iconRequired"),
					path: ["icon"],
				})
			}

			if (
				value.icon_type === appMenuIconType.image &&
				!isValidAppMenuImageUrl(value.icon_url)
			) {
				context.addIssue({
					code: "custom",
					message: t("appMenu.validation.iconUrlInvalid"),
					path: ["icon_url"],
				})
			}
		})
}

function AppMenuFormSkeleton() {
	return (
		<div className="space-y-5" data-testid="platform-app-menu-loading">
			{Array.from({ length: 3 }, (_, section) => (
				<section className="space-y-3" key={section}>
					<Skeleton className="h-4 w-24" />
					<div className="divide-y rounded-md border">
						{Array.from({ length: section === 0 ? 5 : 2 }, (_, row) => (
							<div
								className="grid gap-2 px-4 py-3 md:grid-cols-[180px_1fr]"
								key={row}
							>
								<div className="space-y-2">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-3 w-32" />
								</div>
								<Skeleton className="h-9 w-full" />
							</div>
						))}
					</div>
				</section>
			))}
		</div>
	)
}
