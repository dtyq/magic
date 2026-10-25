import { Loader2, Save, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useDebounceFn } from "ahooks"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { Tabs, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs"
import { Textarea } from "@magic-admin-v2/components/ui/textarea"
import {
	createEmptyOfficialStaffFormState,
	toOfficialStaffFormState,
} from "@magic-admin-v2/features/platform-official-staff/api"
import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field"
import { FieldError } from "@magic-admin-v2/components/form/field-error"
import { useSaveOfficialStaffMutation } from "@magic-admin-v2/features/platform-official-staff/mutations"
import { useOfficialAgentDetailQuery } from "@magic-admin-v2/features/platform-official-staff/queries"
import type {
	OfficialStaff,
	OfficialStaffFormState,
} from "@magic-admin-v2/features/platform-official-staff/types"
import {
	createOfficialStaffFormSchema,
	normalizeErrorMessage,
} from "@magic-admin-v2/features/platform-official-staff/utils/page-utils"
import { Language, type Language as LanguageCode } from "@magic-admin-v2/i18n/resources"
import { TEXT_FILTER_DEBOUNCE_MS } from "@magic-admin-v2/constants/filters"
import { useTranslation } from "react-i18next"

export function OfficialStaffFormDialog({
	canEdit,
	onOpenChange,
	open,
	staff,
}: {
	canEdit: boolean
	onOpenChange: (open: boolean) => void
	open: boolean
	staff: OfficialStaff | null
}) {
	const { t } = useTranslation()
	const [activeLocale, setActiveLocale] = useState<LanguageCode>(Language.ZhCN)
	const [lookupCode, setLookupCode] = useState<string | null>(null)
	const isEdit = Boolean(staff)
	const formSchema = useMemo(() => createOfficialStaffFormSchema(t), [t])
	const form = useForm<OfficialStaffFormState>({
		resolver: zodResolver(formSchema),
		defaultValues: createEmptyOfficialStaffFormState(),
	})
	const identifierField = form.register("identifier")
	const { cancel: cancelAgentLookup, run: scheduleAgentLookup } = useDebounceFn(
		(value: string) => setLookupCode(value.trim() || null),
		{ wait: TEXT_FILTER_DEBOUNCE_MS },
	)
	const saveMutation = useSaveOfficialStaffMutation()
	const agentQuery = useOfficialAgentDetailQuery(lookupCode, open && Boolean(lookupCode))

	useEffect(() => {
		cancelAgentLookup()
		setLookupCode(null)
		if (!open) return
		form.reset(toOfficialStaffFormState(staff))
		setActiveLocale(Language.ZhCN)
	}, [cancelAgentLookup, form, open, staff])

	useEffect(() => {
		if (
			!agentQuery.data ||
			!lookupCode ||
			!open ||
			form.getValues("identifier").trim() !== lookupCode
		) {
			return
		}
		form.setValue(
			"name_i18n",
			{
				zh_CN: agentQuery.data.name_i18n?.zh_CN || agentQuery.data.name_i18n?.default || "",
				en_US: agentQuery.data.name_i18n?.en_US || agentQuery.data.name_i18n?.default || "",
			},
			{ shouldDirty: true, shouldTouch: true, shouldValidate: true },
		)
	}, [agentQuery.data, form, lookupCode, open])

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			cancelAgentLookup()
			setLookupCode(null)
		}
		onOpenChange(nextOpen)
	}

	const handleAgentLookup = () => {
		const code = form.getValues("identifier").trim()
		if (!code) return

		cancelAgentLookup()
		if (lookupCode === code) {
			void agentQuery.refetch()
			return
		}
		setLookupCode(code)
	}

	const handleSubmit = form.handleSubmit(async (values) => {
		if (!canEdit) return
		try {
			await saveMutation.mutateAsync({
				id: staff?.id,
				values,
			})
			toast.success(
				isEdit
					? t("officialStaff.message.staffUpdated")
					: t("officialStaff.message.staffCreated"),
			)
			handleOpenChange(false)
		} catch (error) {
			toast.error(
				normalizeErrorMessage(
					error,
					isEdit
						? t("officialStaff.error.staffUpdateFailed")
						: t("officialStaff.error.staffCreateFailed"),
				),
			)
		}
	})

	const identifier = form.watch("identifier")
	const showAgentLookupError =
		agentQuery.isError && Boolean(lookupCode) && identifier.trim() === lookupCode

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="sm:max-w-2xl"
				closeButtonTestId="official-staff-form-dialog-close-button"
				data-testid="platform-official-staff-dialog-content"
			>
				<DialogHeader>
					<DialogTitle>
						{isEdit
							? t("officialStaff.dialog.editStaffTitle")
							: t("officialStaff.dialog.addStaffTitle")}
					</DialogTitle>
					<DialogDescription>
						{t("officialStaff.dialog.staffDescription")}
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-5" id="official-staff-form" onSubmit={handleSubmit}>
					<DialogFormField
						description={t("officialStaff.fieldDesc.identifier")}
						descriptionMode="text"
						fieldId="official-staff-identifier"
						label={t("officialStaff.field.identifier")}
						required
					>
						<div className="flex gap-2">
							<Input
								{...identifierField}
								data-testid="platform-official-staff-official-staff-identifier-input"
								disabled={staff?.is_default === 1}
								id="official-staff-identifier"
								onChange={(event) => {
									identifierField.onChange(event)
									scheduleAgentLookup(event.target.value)
								}}
								placeholder={t("officialStaff.placeholder.staffIdentifier")}
							/>
							<Button
								disabled={!identifier.trim() || agentQuery.isFetching}
								onClick={handleAgentLookup}
								type="button"
								data-testid="platform-official-staff-search-button"
								variant="outline"
							>
								{agentQuery.isFetching ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Search className="size-4" />
								)}
								{t("officialStaff.action.fetch")}
							</Button>
						</div>
						<FieldError message={form.formState.errors.identifier?.message} />
						{showAgentLookupError ? (
							<FieldError message={t("officialStaff.error.agentNotFound")} />
						) : null}
					</DialogFormField>

					<div className="grid gap-2">
						<div className="flex items-end justify-between gap-3">
							<span className="text-sm font-medium leading-5">
								{t("officialStaff.field.name")}
								<span className="ml-1 text-destructive">*</span>
							</span>
							<Tabs
								onValueChange={(value) => setActiveLocale(value as LanguageCode)}
								value={activeLocale}
							>
								<TabsList>
									<TabsTrigger
										data-testid="platform-official-staff-tab-trigger"
										value={Language.ZhCN}
									>
										{t("language.zhCN")}
									</TabsTrigger>
									<TabsTrigger
										data-testid="platform-official-staff-tab-trigger"
										value={Language.EnUS}
									>
										{t("language.enUS")}
									</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>
						<Input
							data-testid="platform-official-staff-input"
							disabled
							value={form.watch(`name_i18n.${activeLocale}`)}
							placeholder={t("officialStaff.placeholder.staffName")}
						/>
						<FieldError
							message={
								form.formState.errors.name_i18n?.zh_CN?.message ||
								form.formState.errors.name_i18n?.en_US?.message
							}
						/>
					</div>

					<DialogFormField
						description={t("officialStaff.fieldDesc.placeholder")}
						descriptionMode="text"
						fieldId={`official-staff-placeholder-${activeLocale}`}
						label={t("officialStaff.field.placeholder")}
					>
						<Controller
							control={form.control}
							name={`placeholder_i18n.${activeLocale}`}
							render={({ field }) => (
								<Textarea
									data-testid="platform-official-staff-textarea-input"
									{...field}
									placeholder={
										activeLocale === Language.ZhCN
											? t("officialStaff.placeholder.placeholderZh")
											: t("officialStaff.placeholder.placeholderEn")
									}
									id={`official-staff-placeholder-${activeLocale}`}
									rows={4}
								/>
							)}
						/>
					</DialogFormField>

					<div className="grid gap-4 sm:grid-cols-2">
						<DialogFormField
							description={t("officialStaff.fieldDesc.sort")}
							descriptionMode="text"
							fieldId="official-staff-sort"
							label={t("officialStaff.field.sort")}
						>
							<Input
								id="official-staff-sort"
								min={0}
								placeholder={t("officialStaff.placeholder.sort")}
								type="number"
								data-testid="platform-official-staff-official-staff-sort-input"
								{...form.register("sort", { valueAsNumber: true })}
							/>
							<FieldError message={form.formState.errors.sort?.message} />
						</DialogFormField>
						<DialogFormField
							description={t("officialStaff.fieldDesc.organizationWhitelist")}
							descriptionMode="text"
							fieldId="official-staff-organization-whitelist"
							label={t("officialStaff.field.organizationWhitelist")}
						>
							<Input
								data-testid="platform-official-staff-official-staff-organization-whitelist-input"
								id="official-staff-organization-whitelist"
								placeholder={t("officialStaff.placeholder.organizationWhitelist")}
								{...form.register("organization_whitelist")}
							/>
						</DialogFormField>
					</div>
				</form>
				<DialogFooter>
					<Button
						data-testid="platform-official-staff-cancel-button"
						onClick={() => handleOpenChange(false)}
						type="button"
						variant="outline"
					>
						{t("common.cancel")}
					</Button>
					<Button
						data-testid="platform-official-staff-save-button"
						disabled={!canEdit || saveMutation.isPending}
						form="official-staff-form"
						type="submit"
					>
						{saveMutation.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Save className="size-4" />
						)}
						{t("common.save")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
