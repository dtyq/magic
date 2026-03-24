import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Globe, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Textarea } from "@/components/shadcn-ui/textarea"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/shadcn-ui/dialog"
import {
	DEFAULT_LOCALE_KEY,
	type LocaleText,
	type LocaleTextMap,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"

const SUPPORTED_LOCALES = ["en_US", "zh_CN"] as const

interface NormalizedLocaleTextMap extends LocaleTextMap {
	default: string
}

function isNonEmptyValue(value: string | undefined): value is string {
	return typeof value === "string" && value.length > 0
}

/**
 * Normalize LocaleText to an object with a guaranteed default value.
 * Existing locale values are preserved.
 */
export function normalizeLocaleText(text: LocaleText): NormalizedLocaleTextMap {
	if (typeof text === "string") return { [DEFAULT_LOCALE_KEY]: text }

	const fallbackDefault =
		text[DEFAULT_LOCALE_KEY] ?? text["en_US"] ?? text["zh_CN"] ?? Object.values(text)[0] ?? ""
	return { ...text, [DEFAULT_LOCALE_KEY]: fallbackDefault }
}

/** Extract the resolved value for a locale, fallback to default when empty. */
export function getLocaleValue(text: LocaleText, locale: string): string {
	if (typeof text === "string") return text

	const normalized = normalizeLocaleText(text)
	if (isNonEmptyValue(normalized[locale])) return normalized[locale]

	const baseLang = locale.split(/[-_]/)[0]
	const baseMatch = Object.keys(normalized).find(
		(key) => key.startsWith(baseLang) && isNonEmptyValue(normalized[key]),
	)
	if (baseMatch) return normalized[baseMatch]

	if (isNonEmptyValue(normalized[DEFAULT_LOCALE_KEY])) return normalized[DEFAULT_LOCALE_KEY]
	if (isNonEmptyValue(normalized["en_US"])) return normalized["en_US"]
	return Object.values(normalized).find((value) => isNonEmptyValue(value)) ?? ""
}

/** Extract the raw locale value without fallback. */
function getRawLocaleValue(text: LocaleText, locale: string): string {
	if (typeof text === "string") return locale === DEFAULT_LOCALE_KEY ? text : ""
	if (locale === DEFAULT_LOCALE_KEY) return normalizeLocaleText(text)[DEFAULT_LOCALE_KEY]
	return text[locale] ?? ""
}

/** Return a new LocaleText with one locale value updated. */
export function setLocaleValue(text: LocaleText, locale: string, newValue: string): LocaleText {
	const base = normalizeLocaleText(text)
	return { ...base, [locale]: newValue }
}

interface LocaleTextInputProps {
	value: LocaleText
	onChange: (value: LocaleText) => void
	placeholder?: string
	localizeLabel?: string
	/** Render as Textarea instead of Input */
	multiline?: boolean
	disabled?: boolean
	className?: string
	"data-testid"?: string
	/** Error message — highlights the main input border in destructive color */
	error?: string
}

export function LocaleTextInput({
	value,
	onChange,
	placeholder,
	localizeLabel,
	multiline = false,
	disabled = false,
	className,
	"data-testid": testId,
	error,
}: LocaleTextInputProps) {
	const { t } = useTranslation("crew/create")
	const [dialogOpen, setDialogOpen] = useState(false)
	const [draft, setDraft] = useState<NormalizedLocaleTextMap>(normalizeLocaleText(value))
	const localeLabels = useMemo<Record<string, string>>(
		() => ({
			zh_CN: t("playbook.edit.basicInfo.localeDialog.localeLabels.zh_CN"),
			en_US: t("playbook.edit.basicInfo.localeDialog.localeLabels.en_US"),
		}),
		[t],
	)

	useEffect(() => {
		if (!dialogOpen) return
		setDraft(normalizeLocaleText(value))
	}, [dialogOpen, value])

	const defaultValue = getRawLocaleValue(value, DEFAULT_LOCALE_KEY)
	const isDefaultMissing = draft[DEFAULT_LOCALE_KEY].trim().length === 0
	const dialogTitle = t("playbook.edit.basicInfo.localeDialog.title", {
		label: localizeLabel ?? t("playbook.edit.basicInfo.localeDialog.defaultLabel"),
	})

	function handleDefaultChange(newValue: string) {
		onChange(setLocaleValue(value, DEFAULT_LOCALE_KEY, newValue))
	}

	function handleDraftLocaleChange(locale: string, newValue: string) {
		setDraft((prev) => ({ ...prev, [locale]: newValue }))
	}

	function handleConfirmDialog() {
		if (disabled || isDefaultMissing) return
		onChange(draft)
		setDialogOpen(false)
	}

	function renderLocaleField(params: {
		label: string
		value: string
		onChange: (nextValue: string) => void
		placeholder?: string
		testId?: string
		required?: boolean
	}) {
		const { label, value, onChange, placeholder, testId, required } = params
		return (
			<div className="flex flex-col gap-2">
				<label className="text-sm font-medium leading-none text-foreground">{label}</label>
				{multiline ? (
					<Textarea
						value={value}
						onChange={(e) => onChange(e.target.value)}
						placeholder={placeholder}
						required={required}
						disabled={disabled}
						className="min-h-[96px] resize-none bg-background shadow-xs"
						data-testid={testId}
					/>
				) : (
					<Input
						value={value}
						onChange={(e) => onChange(e.target.value)}
						placeholder={placeholder}
						required={required}
						disabled={disabled}
						className="h-9 bg-background shadow-xs"
						data-testid={testId}
					/>
				)}
			</div>
		)
	}

	return (
		<div className="flex flex-1 gap-1.5">
			{multiline ? (
				<Textarea
					value={defaultValue}
					onChange={(e) => handleDefaultChange(e.target.value)}
					placeholder={placeholder}
					required
					disabled={disabled}
					className={cn(
						"flex-1 resize-none bg-background shadow-xs",
						error && "border-destructive",
						className,
					)}
					data-testid={testId}
				/>
			) : (
				<Input
					value={defaultValue}
					onChange={(e) => handleDefaultChange(e.target.value)}
					placeholder={placeholder}
					required
					disabled={disabled}
					className={cn(
						"h-9 flex-1 bg-background shadow-xs",
						error && "border-destructive",
						className,
					)}
					data-testid={testId}
				/>
			)}

			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					if (disabled && open) return
					setDialogOpen(open)
				}}
			>
				<DialogTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="icon"
						className="h-9 w-9 shrink-0 shadow-xs"
						disabled={disabled}
						data-testid={testId ? `${testId}-globe` : undefined}
					>
						<Globe className="h-4 w-4" />
					</Button>
				</DialogTrigger>

				<DialogContent
					showCloseButton={false}
					className="!max-w-[480px] gap-0 overflow-hidden p-0 shadow-sm"
					data-testid={testId ? `${testId}-localize-dialog` : undefined}
				>
					<DialogHeader className="flex-row items-start border-b px-3 py-3">
						<DialogTitle className="text-base font-semibold leading-6">
							{dialogTitle}
						</DialogTitle>
						<DialogClose
							className="ml-auto rounded-xs text-muted-foreground transition-colors hover:text-foreground"
							data-testid={testId ? `${testId}-localize-close` : undefined}
						>
							<span className="sr-only">Close</span>
							<X className="h-4 w-4" />
						</DialogClose>
					</DialogHeader>

					<div className="flex max-h-[70vh] flex-col gap-2.5 overflow-y-auto p-4">
						{renderLocaleField({
							label: t("playbook.edit.basicInfo.localeDialog.original"),
							value: draft[DEFAULT_LOCALE_KEY],
							onChange: (nextValue) =>
								handleDraftLocaleChange(DEFAULT_LOCALE_KEY, nextValue),
							placeholder,
							testId: testId ? `${testId}-default` : undefined,
							required: true,
						})}

						{SUPPORTED_LOCALES.map((localeKey) => (
							<div key={localeKey}>
								{renderLocaleField({
									label: localeLabels[localeKey] ?? localeKey,
									value: getRawLocaleValue(draft, localeKey),
									onChange: (nextValue) =>
										handleDraftLocaleChange(localeKey, nextValue),
									placeholder:
										draft[DEFAULT_LOCALE_KEY].length > 0
											? t(
													"playbook.edit.basicInfo.localeDialog.usingDefault",
													{
														value: draft[DEFAULT_LOCALE_KEY],
													},
												)
											: placeholder,
									testId: testId ? `${testId}-${localeKey}` : undefined,
								})}
							</div>
						))}

						<p className="text-sm text-muted-foreground">
							{t("playbook.edit.basicInfo.localeDialog.fallbackHint")}
						</p>
					</div>

					<DialogFooter className="border-t px-3 py-3">
						<DialogClose asChild>
							<Button
								type="button"
								variant="outline"
								className="h-9 min-w-[82px] shadow-xs"
								data-testid={testId ? `${testId}-localize-cancel` : undefined}
							>
								{t("playbook.edit.basicInfo.localeDialog.cancel")}
							</Button>
						</DialogClose>
						<Button
							type="button"
							className="h-9 min-w-[82px] shadow-xs"
							onClick={handleConfirmDialog}
							disabled={disabled || isDefaultMissing}
							data-testid={testId ? `${testId}-localize-confirm` : undefined}
						>
							{t("playbook.edit.basicInfo.localeDialog.confirm")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
