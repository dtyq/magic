import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronRight, Loader2, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/shadcn-ui/collapsible"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Separator } from "@/components/shadcn-ui/separator"
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
	onSuccess?: () => void | Promise<void>
	isPrePublishMode?: boolean
	defaultNameRequiredMessage?: string
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

function EditCrewDialog({
	open,
	onOpenChange,
	onSuccess,
	isPrePublishMode = false,
	defaultNameRequiredMessage,
}: EditCrewDialogProps) {
	const { t: marketT } = useTranslation("crew/market")
	const { t: createT, i18n } = useTranslation("crew/create")
	const store = useCrewEditStore()
	const avatarInputRef = useRef<HTMLInputElement>(null)
	const previewUrlRef = useRef<string | null>(null)
	const [draft, setDraft] = useState<CrewIdentityDraft>(createEmptyCrewIdentityDraft())
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [localeExpanded, setLocaleExpanded] = useState(false)
	const [showDefaultNameError, setShowDefaultNameError] = useState(false)
	const { upload } = useUpload({ storageType: "public" })

	const sortedLocales = useMemo(() => {
		const current = i18n.language as SupportedLocale
		if (SUPPORTED_LOCALES.includes(current)) {
			return [current, ...SUPPORTED_LOCALES.filter((l) => l !== current)] as SupportedLocale[]
		}
		return [...SUPPORTED_LOCALES]
	}, [i18n.language])

	const localeLabels = useMemo<Record<SupportedLocale, string>>(
		() => ({
			en_US: createT("playbook.edit.basicInfo.localeDialog.localeLabels.en_US"),
			zh_CN: createT("playbook.edit.basicInfo.localeDialog.localeLabels.zh_CN"),
		}),
		[createT],
	)

	useEffect(() => {
		if (!open) return

		setShowDefaultNameError(false)
		const hasValues = SUPPORTED_LOCALES.some(
			(locale) =>
				store.identity.name_i18n?.[locale] ||
				store.identity.role_i18n?.[locale] ||
				store.identity.description_i18n?.[locale],
		)
		setLocaleExpanded(hasValues)

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
		onOpenChange(false)
	}, [isSubmitting, onOpenChange])

	function handleAvatarSelect() {
		if (isSubmitting) return
		avatarInputRef.current?.click()
	}

	function updateField(field: LocalizeField, value: string) {
		if (field === "name" && showDefaultNameError && value.trim()) setShowDefaultNameError(false)

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
		if (isPrePublishMode && !draft.name.default.trim()) {
			setShowDefaultNameError(true)
			return
		}

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
			const isMarkdownSynced = await store.identity.syncI18nFieldsToIdentityMarkdown({
				name_i18n: nameI18n,
				role_i18n: roleI18n,
				description_i18n: descriptionI18n,
			})
			if (!isMarkdownSynced) magicToast.warning(createT("errors.syncIdentityMarkdownFailed"))

			magicToast.success(marketT("editCrew.done"))
			await onSuccess?.()
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
							{isPrePublishMode
								? createT("publishNameDialog.title")
								: marketT("editCrew.title")}
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
										{isPrePublishMode ? (
											<span
												className="ml-0.5 text-destructive"
												aria-hidden="true"
											>
												*
											</span>
										) : null}
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
										aria-invalid={showDefaultNameError}
									/>
									{showDefaultNameError ? (
										<p
											className="text-sm text-destructive"
											data-testid="edit-crew-name-error"
										>
											{defaultNameRequiredMessage ??
												createT("publishNameDialog.required")}
										</p>
									) : null}
								</div>
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
							</div>

							<div
								className="flex items-start gap-2"
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
							</div>

							<Separator />

							<Collapsible
								open={localeExpanded}
								onOpenChange={setLocaleExpanded}
								className="flex flex-col gap-3"
							>
								<CollapsibleTrigger className="group flex w-full items-center gap-1 text-left">
									<ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:hidden" />
									<ChevronDown className="hidden size-4 shrink-0 text-muted-foreground group-data-[state=open]:block" />
									<p className="text-sm font-medium text-muted-foreground">
										{createT("card.localizeDialog.title")}
									</p>
								</CollapsibleTrigger>
								<CollapsibleContent className="flex flex-col gap-3">
									<Tabs defaultValue={sortedLocales[0]}>
										<TabsList className="w-full">
											{sortedLocales.map((locale) => (
												<TabsTrigger
													key={locale}
													value={locale}
													className="flex-1"
													disabled={isSubmitting}
													data-testid={`edit-crew-locale-tab-${locale}`}
												>
													{localeLabels[locale]}
												</TabsTrigger>
											))}
										</TabsList>
										{sortedLocales.map((locale) => (
											<TabsContent
												key={locale}
												value={locale}
												className="mt-3 flex flex-col gap-3"
											>
												<div className="flex items-center gap-2">
													<div className="flex h-9 flex-1 items-center">
														<Label className="w-[172px] shrink-0 text-base font-medium">
															{createT("card.localizeDialog.tabName")}
														</Label>
													</div>
													<Input
														value={draft.name[locale]}
														onChange={(event) =>
															updateLocalizedField(
																"name",
																locale,
																event.target.value,
															)
														}
														placeholder={
															draft.name.default
																? createT(
																		"playbook.edit.basicInfo.localeDialog.usingDefault",
																		{
																			value: draft.name
																				.default,
																		},
																	)
																: createT("card.enterName")
														}
														className="w-[320px] shrink-0"
														disabled={isSubmitting}
														data-testid={`edit-crew-locale-name-${locale}`}
													/>
												</div>
												<div className="flex items-center gap-2">
													<div className="flex h-9 flex-1 items-center">
														<Label className="w-[172px] shrink-0 text-base font-medium">
															{createT("card.localizeDialog.tabRole")}
														</Label>
													</div>
													<Input
														value={draft.role[locale]}
														onChange={(event) =>
															updateLocalizedField(
																"role",
																locale,
																event.target.value,
															)
														}
														placeholder={
															draft.role.default
																? createT(
																		"playbook.edit.basicInfo.localeDialog.usingDefault",
																		{
																			value: draft.role
																				.default,
																		},
																	)
																: createT("card.enterRole")
														}
														className="w-[320px] shrink-0"
														disabled={isSubmitting}
														data-testid={`edit-crew-locale-role-${locale}`}
													/>
												</div>
												<div className="flex items-start gap-2">
													<div className="flex min-h-[96px] flex-1 items-start pt-2">
														<Label className="w-[172px] shrink-0 text-base font-medium">
															{createT(
																"card.localizeDialog.tabDescription",
															)}
														</Label>
													</div>
													<Textarea
														value={draft.description[locale]}
														onChange={(event) =>
															updateLocalizedField(
																"description",
																locale,
																event.target.value,
															)
														}
														placeholder={
															draft.description.default
																? createT(
																		"playbook.edit.basicInfo.localeDialog.usingDefault",
																		{
																			value: draft.description
																				.default,
																		},
																	)
																: createT("card.enterDescription")
														}
														className="min-h-[96px] w-[320px] shrink-0 resize-none"
														disabled={isSubmitting}
														data-testid={`edit-crew-locale-description-${locale}`}
													/>
												</div>
												<p className="text-sm text-muted-foreground">
													{createT(
														"playbook.edit.basicInfo.localeDialog.fallbackHint",
													)}
												</p>
											</TabsContent>
										))}
									</Tabs>
								</CollapsibleContent>
							</Collapsible>
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
		</>
	)
}

export default memo(EditCrewDialog)
