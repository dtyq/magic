import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Globe, Loader2, Upload, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { Textarea } from "@/components/shadcn-ui/textarea"
import {
	type CrewI18nArrayText,
	type CrewI18nText,
	normalizeCrewI18nArrayValue,
	resolveCrewIconUrl,
} from "@/apis/modules/crew"
import magicToast from "@/components/base/MagicToaster/utils"
import { useUpload } from "@/hooks/useUploadFiles"
import { crewService } from "@/services/crew/CrewService"
import { useCrewEditStore } from "../../context"
import { RoleIcon } from "../common/RoleIcon"

const SUPPORTED_LOCALES = ["en_US", "zh_CN"] as const

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
type LocalizeField = "name" | "role" | "description"

interface LocaleFieldDraft {
	default: string
	en_US: string
	zh_CN: string
}

interface CrewIdentityDraft {
	iconUrl?: string
	iconFile?: File
	name: LocaleFieldDraft
	role: LocaleFieldDraft
	description: LocaleFieldDraft
}

interface EditCrewDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

function createEmptyLocaleFieldDraft(): LocaleFieldDraft {
	return {
		default: "",
		en_US: "",
		zh_CN: "",
	}
}

function createEmptyCrewIdentityDraft(): CrewIdentityDraft {
	return {
		iconUrl: undefined,
		iconFile: undefined,
		name: createEmptyLocaleFieldDraft(),
		role: createEmptyLocaleFieldDraft(),
		description: createEmptyLocaleFieldDraft(),
	}
}

function extractI18nTextDraft(i18n: CrewI18nText): LocaleFieldDraft {
	return {
		default: i18n.default ?? "",
		en_US: i18n.en_US ?? "",
		zh_CN: i18n.zh_CN ?? "",
	}
}

function extractI18nArrayDraft(i18n: CrewI18nArrayText): LocaleFieldDraft {
	return {
		default: normalizeCrewI18nArrayValue(i18n.default),
		en_US: normalizeCrewI18nArrayValue(i18n.en_US),
		zh_CN: normalizeCrewI18nArrayValue(i18n.zh_CN),
	}
}

function createDraftFromStore({
	iconUrl,
	nameI18n,
	roleI18n,
	descriptionI18n,
}: {
	iconUrl: string
	nameI18n: CrewI18nText
	roleI18n: CrewI18nArrayText
	descriptionI18n: CrewI18nText
}): CrewIdentityDraft {
	return {
		iconUrl: iconUrl || undefined,
		iconFile: undefined,
		name: extractI18nTextDraft(nameI18n),
		role: extractI18nArrayDraft(roleI18n),
		description: extractI18nTextDraft(descriptionI18n),
	}
}

function buildTextI18n(draft: LocaleFieldDraft, previousValue: CrewI18nText): CrewI18nText {
	return {
		...previousValue,
		default: draft.default,
		en_US: draft.en_US,
		zh_CN: draft.zh_CN,
	}
}

function buildRoleI18n(
	draft: LocaleFieldDraft,
	previousValue: CrewI18nArrayText,
): CrewI18nArrayText {
	return {
		...previousValue,
		default: draft.default.trim() ? [draft.default.trim()] : [],
		en_US: draft.en_US.trim() ? [draft.en_US.trim()] : [],
		zh_CN: draft.zh_CN.trim() ? [draft.zh_CN.trim()] : [],
	}
}

function EditCrewLocalizeDialog({
	open,
	onOpenChange,
	initialField,
	draft,
	onChange,
	disabled,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	initialField: LocalizeField
	draft: CrewIdentityDraft
	onChange: (field: LocalizeField, locale: keyof LocaleFieldDraft, value: string) => void
	disabled: boolean
}) {
	const { t } = useTranslation("crew/create")
	const [activeTab, setActiveTab] = useState<LocalizeField>(initialField)

	useEffect(() => {
		if (!open) return
		setActiveTab(initialField)
	}, [initialField, open])

	const localeLabels = useMemo<Record<SupportedLocale, string>>(
		() => ({
			en_US: t("playbook.edit.basicInfo.localeDialog.localeLabels.en_US"),
			zh_CN: t("playbook.edit.basicInfo.localeDialog.localeLabels.zh_CN"),
		}),
		[t],
	)

	function getFieldDraft(field: LocalizeField) {
		return draft[field]
	}

	function getFieldPlaceholder(field: LocalizeField) {
		if (field === "role") return t("card.enterRole")
		if (field === "description") return t("card.enterDescription")
		return t("card.enterName")
	}

	function renderLocaleFields(field: LocalizeField, multiline = false) {
		const fieldDraft = getFieldDraft(field)
		const placeholder = getFieldPlaceholder(field)
		const defaultHint = fieldDraft.default
			? t("playbook.edit.basicInfo.localeDialog.usingDefault", { value: fieldDraft.default })
			: placeholder

		return (
			<div className="flex flex-col gap-2.5">
				<div className="flex flex-col gap-2">
					<label className="text-sm font-medium leading-none text-foreground">
						{t("playbook.edit.basicInfo.localeDialog.original")}
					</label>
					{multiline ? (
						<Textarea
							value={fieldDraft.default}
							onChange={(event) => onChange(field, "default", event.target.value)}
							placeholder={placeholder}
							className="min-h-[72px] resize-none shadow-xs"
							data-testid={`edit-crew-localize-${field}-default`}
							disabled={disabled}
						/>
					) : (
						<Input
							value={fieldDraft.default}
							onChange={(event) => onChange(field, "default", event.target.value)}
							placeholder={placeholder}
							className="h-9 shadow-xs"
							data-testid={`edit-crew-localize-${field}-default`}
							disabled={disabled}
						/>
					)}
				</div>
				{SUPPORTED_LOCALES.map((locale) => (
					<div key={locale} className="flex flex-col gap-2">
						<label className="text-sm font-medium leading-none text-foreground">
							{localeLabels[locale]}
						</label>
						{multiline ? (
							<Textarea
								value={fieldDraft[locale]}
								onChange={(event) => onChange(field, locale, event.target.value)}
								placeholder={defaultHint}
								className="min-h-[72px] resize-none shadow-xs"
								data-testid={`edit-crew-localize-${field}-${locale}`}
								disabled={disabled}
							/>
						) : (
							<Input
								value={fieldDraft[locale]}
								onChange={(event) => onChange(field, locale, event.target.value)}
								placeholder={defaultHint}
								className="h-9 shadow-xs"
								data-testid={`edit-crew-localize-${field}-${locale}`}
								disabled={disabled}
							/>
						)}
					</div>
				))}
				<p className="text-sm text-muted-foreground">
					{t("playbook.edit.basicInfo.localeDialog.fallbackHint")}
				</p>
			</div>
		)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="!max-w-[480px] gap-0 overflow-hidden p-0 shadow-sm"
				data-testid="edit-crew-localize-dialog"
			>
				<DialogHeader className="flex-row items-start border-b px-3 py-3">
					<DialogTitle className="text-base font-semibold leading-6">
						{t("card.localizeDialog.title")}
					</DialogTitle>
					<DialogClose
						className="ml-auto rounded-xs text-muted-foreground transition-colors hover:text-foreground"
						data-testid="edit-crew-localize-close"
					>
						<span className="sr-only">Close</span>
						<X className="h-4 w-4" />
					</DialogClose>
				</DialogHeader>
				<Tabs
					value={activeTab}
					onValueChange={(value) => setActiveTab(value as LocalizeField)}
					className="gap-0"
				>
					<div className="px-4 pt-4">
						<TabsList className="w-full">
							<TabsTrigger
								value="name"
								className="flex-1"
								data-testid="edit-crew-tab-name"
							>
								{t("card.localizeDialog.tabName")}
							</TabsTrigger>
							<TabsTrigger
								value="role"
								className="flex-1"
								data-testid="edit-crew-tab-role"
							>
								{t("card.localizeDialog.tabRole")}
							</TabsTrigger>
							<TabsTrigger
								value="description"
								className="flex-1"
								data-testid="edit-crew-tab-description"
							>
								{t("card.localizeDialog.tabDescription")}
							</TabsTrigger>
						</TabsList>
					</div>
					<div className="max-h-[60vh] overflow-y-auto p-4">
						<TabsContent value="name">{renderLocaleFields("name")}</TabsContent>
						<TabsContent value="role">{renderLocaleFields("role")}</TabsContent>
						<TabsContent value="description">
							{renderLocaleFields("description", true)}
						</TabsContent>
					</div>
				</Tabs>
				<DialogFooter className="border-t px-3 py-3">
					<DialogClose asChild>
						<Button
							type="button"
							variant="outline"
							className="h-9 min-w-[82px] shadow-xs"
							data-testid="edit-crew-localize-cancel"
							disabled={disabled}
						>
							{t("playbook.edit.basicInfo.localeDialog.cancel")}
						</Button>
					</DialogClose>
					<DialogClose asChild>
						<Button
							type="button"
							className="h-9 min-w-[82px] shadow-xs"
							data-testid="edit-crew-localize-confirm"
							disabled={disabled}
						>
							{t("playbook.edit.basicInfo.localeDialog.confirm")}
						</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

function EditCrewDialog({ open, onOpenChange }: EditCrewDialogProps) {
	const { t: marketT } = useTranslation("crew/market")
	const { t: createT } = useTranslation("crew/create")
	const store = useCrewEditStore()
	const avatarInputRef = useRef<HTMLInputElement>(null)
	const previewUrlRef = useRef<string | null>(null)
	const [draft, setDraft] = useState<CrewIdentityDraft>(createEmptyCrewIdentityDraft())
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [localizeField, setLocalizeField] = useState<LocalizeField>("name")
	const [localizeOpen, setLocalizeOpen] = useState(false)
	const { upload } = useUpload({ storageType: "public" })

	useEffect(() => {
		if (!open) return

		setDraft(
			createDraftFromStore({
				iconUrl: resolveCrewIconUrl(store.identity.icon),
				nameI18n: store.identity.name_i18n,
				roleI18n: store.identity.role_i18n,
				descriptionI18n: store.identity.description_i18n,
			}),
		)
	}, [
		open,
		store.identity.description_i18n,
		store.identity.icon,
		store.identity.name_i18n,
		store.identity.role_i18n,
	])

	const handleClose = useCallback(() => {
		if (isSubmitting) return
		if (previewUrlRef.current) {
			URL.revokeObjectURL(previewUrlRef.current)
			previewUrlRef.current = null
		}
		setLocalizeOpen(false)
		onOpenChange(false)
	}, [isSubmitting, onOpenChange])

	function handleAvatarSelect() {
		if (isSubmitting) return
		avatarInputRef.current?.click()
	}

	function handleOpenLocalize(field: LocalizeField) {
		if (isSubmitting) return
		setLocalizeField(field)
		setLocalizeOpen(true)
	}

	function updateField(field: LocalizeField, value: string) {
		setDraft((prev) => ({
			...prev,
			[field]: {
				...prev[field],
				default: value,
			},
		}))
	}

	function updateLocalizedField(
		field: LocalizeField,
		locale: keyof LocaleFieldDraft,
		value: string,
	) {
		setDraft((prev) => ({
			...prev,
			[field]: {
				...prev[field],
				[locale]: value,
			},
		}))
	}

	function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0]
		if (!file) return

		if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
		const previewUrl = URL.createObjectURL(file)
		previewUrlRef.current = previewUrl
		setDraft((prev) => ({
			...prev,
			iconUrl: previewUrl,
			iconFile: file,
		}))
		event.target.value = ""
	}

	async function handleConfirm() {
		if (!store.crewCode) return

		setIsSubmitting(true)
		try {
			let iconUrl = draft.iconUrl
			if (draft.iconFile) {
				const { fullfilled } = await upload([
					{ name: draft.iconFile.name, file: draft.iconFile, status: "init" },
				])
				const uploadedIconKey = fullfilled[0]?.value?.key
				if (!uploadedIconKey) throw new Error("Upload avatar failed")
				iconUrl = uploadedIconKey
			}

			const nameI18n = buildTextI18n(draft.name, store.identity.name_i18n)
			const roleI18n = buildRoleI18n(draft.role, store.identity.role_i18n)
			const descriptionI18n = buildTextI18n(
				draft.description,
				store.identity.description_i18n,
			)

			await crewService.updateAgentInfo(store.crewCode, {
				name_i18n: nameI18n,
				role_i18n: roleI18n,
				description_i18n: descriptionI18n,
				icon: iconUrl ? { type: "Image", value: iconUrl } : { value: "" },
				icon_type: iconUrl ? 2 : undefined,
			})

			await store.refreshAgentDetail()

			magicToast.success(marketT("editCrew.done"))
			handleClose()
		} catch {
			magicToast.error(marketT("editCrew.errors.saveFailed"))
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<>
			<Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
				<DialogContent
					className="w-[586px] !max-w-[586px] gap-0 overflow-hidden p-0"
					data-testid="edit-crew-dialog"
				>
					<DialogHeader className="border-b border-border px-3 py-3">
						<DialogTitle className="text-base font-semibold">
							{marketT("editCrew.title")}
						</DialogTitle>
					</DialogHeader>

					<ScrollArea className="max-h-[70vh] p-4">
						<div className="flex flex-col gap-4" data-testid="edit-crew-form">
							<input
								ref={avatarInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								onChange={handleAvatarChange}
								data-testid="edit-crew-avatar-input"
							/>

							<div className="flex items-start gap-2">
								<div className="flex h-9 flex-1 items-center">
									<Label className="w-[172px] shrink-0 text-base font-medium">
										{marketT("editCrew.fields.avatar")}
									</Label>
								</div>
								<div className="mr-12 flex flex-col items-center gap-2">
									<div
										className="flex size-[128px] items-center justify-center overflow-hidden rounded-sm border border-border"
										data-testid="edit-crew-avatar-preview"
									>
										{draft.iconUrl ? (
											<img
												src={draft.iconUrl}
												alt=""
												className="size-full object-cover"
											/>
										) : (
											<div className="flex size-full items-center justify-center bg-muted">
												<RoleIcon className="size-10 text-muted-foreground" />
											</div>
										)}
									</div>
									<Button
										variant="outline"
										size="sm"
										className="gap-1.5"
										onClick={handleAvatarSelect}
										data-testid="edit-crew-avatar-upload-button"
										disabled={isSubmitting}
									>
										<Upload className="size-4" />
										{marketT("editCrew.actions.upload")}
									</Button>
								</div>
							</div>

							<div
								className="flex items-start gap-2"
								data-testid="edit-crew-name-field"
							>
								<div className="flex h-9 flex-1 items-center">
									<Label className="w-[172px] shrink-0 text-base font-medium">
										{createT("card.localizeDialog.tabName")}
									</Label>
								</div>
								<div className="flex w-[320px] shrink-0 flex-col gap-2">
									<Input
										value={draft.name.default}
										onChange={(event) =>
											updateField("name", event.target.value)
										}
										placeholder={createT("card.enterName")}
										data-testid="edit-crew-name-input"
										disabled={isSubmitting}
									/>
								</div>
								<Button
									variant="outline"
									size="icon"
									className="size-9 shrink-0"
									onClick={() => handleOpenLocalize("name")}
									data-testid="edit-crew-name-localize-button"
									disabled={isSubmitting}
								>
									<Globe className="size-4" />
								</Button>
							</div>

							<div
								className="flex items-start gap-2"
								data-testid="edit-crew-role-field"
							>
								<div className="flex h-9 flex-1 items-center">
									<Label className="w-[172px] shrink-0 text-base font-medium">
										{createT("card.localizeDialog.tabRole")}
									</Label>
								</div>
								<div className="flex w-[320px] shrink-0 flex-col gap-2">
									<Input
										value={draft.role.default}
										onChange={(event) =>
											updateField("role", event.target.value)
										}
										placeholder={createT("card.enterRole")}
										data-testid="edit-crew-role-input"
										disabled={isSubmitting}
									/>
								</div>
								<Button
									variant="outline"
									size="icon"
									className="size-9 shrink-0"
									onClick={() => handleOpenLocalize("role")}
									data-testid="edit-crew-role-localize-button"
									disabled={isSubmitting}
								>
									<Globe className="size-4" />
								</Button>
							</div>

							<div
								className="mb-1 flex items-start gap-2"
								data-testid="edit-crew-description-field"
							>
								<div className="flex min-h-[96px] flex-1 items-start pt-2">
									<Label className="w-[172px] shrink-0 text-base font-medium">
										{createT("card.localizeDialog.tabDescription")}
									</Label>
								</div>
								<div className="flex w-[320px] shrink-0 flex-col gap-2">
									<Textarea
										value={draft.description.default}
										onChange={(event) =>
											updateField("description", event.target.value)
										}
										placeholder={createT("card.enterDescription")}
										className="min-h-[96px] resize-none"
										data-testid="edit-crew-description-input"
										disabled={isSubmitting}
									/>
								</div>
								<Button
									variant="outline"
									size="icon"
									className="size-9 shrink-0"
									onClick={() => handleOpenLocalize("description")}
									data-testid="edit-crew-description-localize-button"
									disabled={isSubmitting}
								>
									<Globe className="size-4" />
								</Button>
							</div>
						</div>
					</ScrollArea>

					<DialogFooter className="border-t border-border px-3 py-3">
						<div className="flex items-center gap-1.5">
							<Button
								variant="outline"
								size="sm"
								onClick={handleClose}
								data-testid="edit-crew-cancel-button"
								disabled={isSubmitting}
							>
								{marketT("editCrew.buttons.cancel")}
							</Button>
							<Button
								size="sm"
								disabled={isSubmitting}
								onClick={handleConfirm}
								data-testid="edit-crew-confirm-button"
							>
								{isSubmitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
								{marketT("editCrew.buttons.confirm")}
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<EditCrewLocalizeDialog
				open={localizeOpen}
				onOpenChange={setLocalizeOpen}
				initialField={localizeField}
				draft={draft}
				onChange={updateLocalizedField}
				disabled={isSubmitting}
			/>
		</>
	)
}

export default memo(EditCrewDialog)
