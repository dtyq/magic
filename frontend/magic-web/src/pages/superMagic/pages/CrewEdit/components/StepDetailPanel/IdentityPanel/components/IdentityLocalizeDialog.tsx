import { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { X } from "lucide-react"
import { observer } from "mobx-react-lite"
import {
	Dialog,
	DialogContent,
	DialogClose,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/shadcn-ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/shadcn-ui/tabs"
import { Input } from "@/components/shadcn-ui/input"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { Button } from "@/components/shadcn-ui/button"
import { useCrewEditStore } from "../../../../context"
import {
	type CrewI18nText,
	type CrewI18nArrayText,
	normalizeCrewI18nArrayValue,
} from "@/apis/modules/crew"

const SUPPORTED_LOCALES = ["en_US", "zh_CN"] as const
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

interface LocaleFieldDraft {
	default: string
	en_US: string
	zh_CN: string
}

interface DraftState {
	name: LocaleFieldDraft
	role: LocaleFieldDraft
	description: LocaleFieldDraft
}

type TabField = keyof DraftState

function extractI18nText(i18n: CrewI18nText): LocaleFieldDraft {
	return {
		default: i18n.default ?? "",
		en_US: (i18n.en_US as string | undefined) ?? "",
		zh_CN: (i18n.zh_CN as string | undefined) ?? "",
	}
}

function extractI18nArrayText(i18n: CrewI18nArrayText): LocaleFieldDraft {
	const getString = (value: unknown) => normalizeCrewI18nArrayValue(value)
	const defaultValue = getString(i18n.default) || getString(i18n.en_US) || getString(i18n.zh_CN)
	return {
		default: defaultValue,
		en_US: getString(i18n.en_US),
		zh_CN: getString(i18n.zh_CN),
	}
}

interface IdentityLocalizeDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	disabled?: boolean
	initialTab?: TabField
}

function IdentityLocalizeDialogInner({
	open,
	onOpenChange,
	disabled = false,
	initialTab = "name",
}: IdentityLocalizeDialogProps) {
	const { t } = useTranslation("crew/create")
	const store = useCrewEditStore()
	const { identity } = store

	const [activeTab, setActiveTab] = useState<TabField>("name")
	const [draft, setDraft] = useState<DraftState>({
		name: { default: "", en_US: "", zh_CN: "" },
		role: { default: "", en_US: "", zh_CN: "" },
		description: { default: "", en_US: "", zh_CN: "" },
	})

	// Sync draft from store whenever dialog opens
	useEffect(() => {
		if (!open) return
		setActiveTab(initialTab)
		setDraft({
			name: extractI18nText(identity.name_i18n),
			role: extractI18nArrayText(identity.role_i18n),
			description: extractI18nText(identity.description_i18n),
		})
	}, [identity.description_i18n, identity.name_i18n, identity.role_i18n, initialTab, open])

	useEffect(() => {
		if (disabled && open) onOpenChange(false)
	}, [disabled, onOpenChange, open])

	const localeLabels = useMemo<Record<SupportedLocale, string>>(
		() => ({
			en_US: t("playbook.edit.basicInfo.localeDialog.localeLabels.en_US"),
			zh_CN: t("playbook.edit.basicInfo.localeDialog.localeLabels.zh_CN"),
		}),
		[t],
	)
	const fieldPlaceholders = useMemo<Record<TabField, string>>(
		() => ({
			name: t("card.enterName"),
			role: t("card.enterRole"),
			description: t("card.enterDescription"),
		}),
		[t],
	)

	function updateDraftField(field: TabField, locale: keyof LocaleFieldDraft, value: string) {
		setDraft((prev) => ({
			...prev,
			[field]: { ...prev[field], [locale]: value },
		}))
	}

	function handleConfirm() {
		const prevName = identity.name_i18n
		const prevRole = identity.role_i18n
		const prevDescription = identity.description_i18n

		const nameI18n: CrewI18nText = {
			...prevName,
			default: draft.name.default,
		}
		if (draft.name.en_US.trim()) nameI18n.en_US = draft.name.en_US
		if (draft.name.zh_CN.trim()) nameI18n.zh_CN = draft.name.zh_CN

		// Role i18n is written as string arrays. Reads still normalize legacy
		// string-shaped payloads for backward compatibility.
		const roleI18n: CrewI18nArrayText = {
			...prevRole,
			default: draft.role.default.trim() ? [draft.role.default] : [],
		}
		if (draft.role.en_US.trim()) roleI18n.en_US = [draft.role.en_US]
		if (draft.role.zh_CN.trim()) roleI18n.zh_CN = [draft.role.zh_CN]

		const descriptionI18n: CrewI18nText = {
			...prevDescription,
			default: draft.description.default,
		}
		if (draft.description.en_US.trim()) descriptionI18n.en_US = draft.description.en_US
		if (draft.description.zh_CN.trim()) descriptionI18n.zh_CN = draft.description.zh_CN

		void identity.setI18nFields({
			name_i18n: nameI18n,
			role_i18n: roleI18n,
			description_i18n: descriptionI18n,
		})
		onOpenChange(false)
	}

	function renderLocaleFields(field: TabField, multiline = false) {
		const fieldDraft = draft[field]
		const fallbackPlaceholder = fieldPlaceholders[field]

		const usingDefaultPlaceholder = fieldDraft.default
			? t("playbook.edit.basicInfo.localeDialog.usingDefault", { value: fieldDraft.default })
			: fallbackPlaceholder

		return (
			<div className="flex flex-col gap-2.5">
				{/* Original (Default) */}
				<div className="flex flex-col gap-2">
					<label className="text-sm font-medium leading-none text-foreground">
						{t("playbook.edit.basicInfo.localeDialog.original")}
					</label>
					{multiline ? (
						<Textarea
							value={fieldDraft.default}
							onChange={(e) => updateDraftField(field, "default", e.target.value)}
							placeholder={fallbackPlaceholder}
							className="min-h-[60px] resize-none shadow-xs"
							data-testid={`crew-localize-${field}-default`}
							disabled={disabled}
						/>
					) : (
						<Input
							value={fieldDraft.default}
							onChange={(e) => updateDraftField(field, "default", e.target.value)}
							placeholder={fallbackPlaceholder}
							className="h-9 shadow-xs"
							data-testid={`crew-localize-${field}-default`}
							disabled={disabled}
						/>
					)}
				</div>

				{/* Per-locale fields */}
				{SUPPORTED_LOCALES.map((locale) => (
					<div key={locale} className="flex flex-col gap-2">
						<label className="text-sm font-medium leading-none text-foreground">
							{localeLabels[locale]}
						</label>
						{multiline ? (
							<Textarea
								value={fieldDraft[locale]}
								onChange={(e) => updateDraftField(field, locale, e.target.value)}
								placeholder={usingDefaultPlaceholder}
								className="min-h-[60px] resize-none shadow-xs"
								data-testid={`crew-localize-${field}-${locale}`}
								disabled={disabled}
							/>
						) : (
							<Input
								value={fieldDraft[locale]}
								onChange={(e) => updateDraftField(field, locale, e.target.value)}
								placeholder={usingDefaultPlaceholder}
								className="h-9 shadow-xs"
								data-testid={`crew-localize-${field}-${locale}`}
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
				data-testid="crew-identity-localize-dialog"
			>
				<DialogHeader className="flex-row items-start border-b px-3 py-3">
					<DialogTitle className="text-base font-semibold leading-6">
						{t("card.localizeDialog.title")}
					</DialogTitle>
					<DialogClose
						className="ml-auto rounded-xs text-muted-foreground transition-colors hover:text-foreground"
						data-testid="crew-identity-localize-close"
					>
						<span className="sr-only">Close</span>
						<X className="h-4 w-4" />
					</DialogClose>
				</DialogHeader>

				<Tabs
					value={activeTab}
					onValueChange={(v) => {
						if (disabled) return
						setActiveTab(v as TabField)
					}}
					className="gap-0"
				>
					<div className="px-4 pt-4">
						<TabsList className="w-full">
							<TabsTrigger
								value="name"
								className="flex-1"
								data-testid="crew-localize-tab-name"
							>
								{t("card.localizeDialog.tabName")}
							</TabsTrigger>
							<TabsTrigger
								value="role"
								className="flex-1"
								data-testid="crew-localize-tab-role"
							>
								{t("card.localizeDialog.tabRole")}
							</TabsTrigger>
							<TabsTrigger
								value="description"
								className="flex-1"
								data-testid="crew-localize-tab-description"
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
							data-testid="crew-localize-cancel"
							disabled={disabled}
						>
							{t("playbook.edit.basicInfo.localeDialog.cancel")}
						</Button>
					</DialogClose>
					<Button
						type="button"
						className="h-9 min-w-[82px] shadow-xs"
						onClick={handleConfirm}
						data-testid="crew-localize-confirm"
						disabled={disabled}
					>
						{t("playbook.edit.basicInfo.localeDialog.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export const IdentityLocalizeDialog = observer(IdentityLocalizeDialogInner)
