import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CirclePlus, Globe, X } from "lucide-react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/opensource/components/shadcn-ui/dialog"
import {
	DEFAULT_LOCALE_KEY,
	type LocaleText,
	type LocaleTextMap,
} from "@/opensource/pages/superMagic/components/MainInputContainer/panels/types"
import { normalizeLocaleText } from "../LocaleTextInput"
import { PresetContentEditor, type PresetContentEditorHandle } from "./PresetContentEditor"

const SUPPORTED_LOCALES = ["en_US", "zh_CN"] as const

interface NormalizedLocaleTextMap extends LocaleTextMap {
	default: string
}

interface PresetContentLocaleDialogProps {
	value: LocaleText
	onChange: (value: LocaleText) => void
	placeholder?: string
	localizeLabel?: string
	"data-testid"?: string
}

function getRawLocaleValue(text: LocaleText, locale: string): string {
	if (typeof text === "string") return locale === DEFAULT_LOCALE_KEY ? text : ""
	if (locale === DEFAULT_LOCALE_KEY) return normalizeLocaleText(text)[DEFAULT_LOCALE_KEY]
	return text[locale] ?? ""
}

export function PresetContentLocaleDialog({
	value,
	onChange,
	placeholder,
	localizeLabel,
	"data-testid": testId,
}: PresetContentLocaleDialogProps) {
	const { t } = useTranslation("crew/create")
	const [dialogOpen, setDialogOpen] = useState(false)
	const [draft, setDraft] = useState<NormalizedLocaleTextMap>(normalizeLocaleText(value))
	const editorRefs = useRef<Record<string, PresetContentEditorHandle | null>>({})
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

	const isDefaultMissing = draft[DEFAULT_LOCALE_KEY].trim().length === 0
	const dialogTitle = t("playbook.edit.basicInfo.localeDialog.title", {
		label: localizeLabel ?? t("playbook.edit.basicInfo.localeDialog.defaultLabel"),
	})

	function handleDraftLocaleChange(locale: string, newValue: string) {
		setDraft((prev) => ({ ...prev, [locale]: newValue }))
	}

	function setEditorRef(locale: string, editor: PresetContentEditorHandle | null) {
		editorRefs.current[locale] = editor
	}

	function handleInsertPresetValue(locale: string) {
		editorRefs.current[locale]?.insertPresetValue()
	}

	function handleConfirmDialog() {
		if (isDefaultMissing) return
		onChange(draft)
		setDialogOpen(false)
	}

	function renderLocaleField(params: {
		locale: string
		label: string
		value: string
		onChange: (nextValue: string) => void
		placeholder?: string
		testId?: string
	}) {
		const { locale, label, value, onChange, placeholder, testId } = params
		return (
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-2">
					<label className="text-sm font-medium leading-none text-foreground">
						{label}
					</label>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="shadow-xs h-8 gap-2 px-3 text-xs font-medium text-foreground"
						onClick={() => handleInsertPresetValue(locale)}
						data-testid={testId ? `${testId}-insert-preset-value-btn` : undefined}
					>
						<CirclePlus className="h-4 w-4" />
						{t("playbook.edit.presets.form.insertPresetValue")}
					</Button>
				</div>
				<PresetContentEditor
					ref={(editor) => setEditorRef(locale, editor)}
					value={value}
					onChange={onChange}
					placeholder={placeholder}
					data-testid={testId}
				/>
			</div>
		)
	}

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<DialogTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="shadow-xs h-8 w-8"
					data-testid={testId ? `${testId}-locale-btn` : undefined}
					aria-label={localizeLabel}
				>
					<Globe className="h-4 w-4" />
				</Button>
			</DialogTrigger>

			<DialogContent
				showCloseButton={false}
				className="!max-w-[560px] gap-0 overflow-hidden p-0 shadow-sm"
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
						locale: DEFAULT_LOCALE_KEY,
						label: t("playbook.edit.basicInfo.localeDialog.original"),
						value: draft[DEFAULT_LOCALE_KEY],
						onChange: (nextValue) =>
							handleDraftLocaleChange(DEFAULT_LOCALE_KEY, nextValue),
						placeholder,
						testId: testId ? `${testId}-default` : undefined,
					})}

					{SUPPORTED_LOCALES.map((localeKey) => (
						<div key={localeKey}>
							{renderLocaleField({
								locale: localeKey,
								label: localeLabels[localeKey] ?? localeKey,
								value: getRawLocaleValue(draft, localeKey),
								onChange: (nextValue) =>
									handleDraftLocaleChange(localeKey, nextValue),
								placeholder:
									draft[DEFAULT_LOCALE_KEY].length > 0
										? t("playbook.edit.basicInfo.localeDialog.usingDefault", {
												value: draft[DEFAULT_LOCALE_KEY],
											})
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
							className="shadow-xs h-9 min-w-[82px]"
							data-testid={testId ? `${testId}-localize-cancel` : undefined}
						>
							{t("playbook.edit.basicInfo.localeDialog.cancel")}
						</Button>
					</DialogClose>
					<Button
						type="button"
						className="shadow-xs h-9 min-w-[82px]"
						onClick={handleConfirmDialog}
						disabled={isDefaultMissing}
						data-testid={testId ? `${testId}-localize-confirm` : undefined}
					>
						{t("playbook.edit.basicInfo.localeDialog.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
