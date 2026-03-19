import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CirclePlus, GripVertical, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Switch } from "@/components/shadcn-ui/switch"
import { Separator } from "@/components/shadcn-ui/separator"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { DEFAULT_LOCALE_KEY } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import type {
	FieldItem,
	LocaleText,
	OptionItem,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { localeTextToDisplayString } from "@/pages/superMagic/components/MainInputContainer/panels/utils"
import { LocaleTextInput, setLocaleValue } from "../LocaleTextInput"
import { PresetContentEditor, type PresetContentEditorHandle } from "./PresetContentEditor"
import { PresetContentLocaleDialog } from "./PresetContentLocaleDialog"

function genKey() {
	return Math.random().toString(36).slice(2)
}

// Stable internal key for tracking identity, decoupled from editable `value`
interface FormOptionItem extends OptionItem {
	_key: string
}

interface PresetItemFormState {
	label: LocaleText
	options: FormOptionItem[]
	// Stores _key of the default option (not opt.value, which is user-editable)
	default_key: string
	preset_content: LocaleText
}

interface PresetItemEditDialogProps {
	item?: FieldItem
	open: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: (data: Partial<FieldItem>) => void
}

const EMPTY_FORM: PresetItemFormState = {
	label: "",
	options: [],
	default_key: "",
	preset_content: "",
}

function itemToForm(item: FieldItem): PresetItemFormState {
	const rawOptions = (item.options ?? []).filter(
		(opt): opt is OptionItem => !("group_key" in opt),
	)
	const options: FormOptionItem[] = rawOptions.map((opt) => ({
		...opt,
		_key: genKey(),
	}))
	const defaultValue = localeTextToDisplayString(item.default_value).trim()
	// Match the persisted default with the same normalization used at runtime.
	const defaultOpt = options.find(
		(opt) => localeTextToDisplayString(opt.value).trim() === defaultValue,
	)
	return {
		label: item.label ?? "",
		options,
		default_key: defaultOpt?._key ?? "",
		preset_content: item.preset_content ?? "",
	}
}

interface FormErrors {
	label?: string
	options?: string
}

function isLabelEmpty(label: LocaleText): boolean {
	if (typeof label === "string") return label.trim() === ""
	return Object.values(label).every((v) => !v || v.trim() === "")
}

function isLocaleTextEmpty(text: LocaleText | undefined): boolean {
	if (text == null) return true
	if (typeof text === "string") return text.trim() === ""
	return Object.values(text).every((value) => !value || value.trim() === "")
}

function getRawLocaleValue(text: LocaleText, locale: string): string {
	if (typeof text === "string") return locale === DEFAULT_LOCALE_KEY ? text : ""
	if (locale === DEFAULT_LOCALE_KEY) return text[DEFAULT_LOCALE_KEY] ?? ""
	return text[locale] ?? ""
}

export function PresetItemEditDialog({
	item,
	open,
	onOpenChange,
	onConfirm,
}: PresetItemEditDialogProps) {
	const { t } = useTranslation("crew/create")
	const isEditing = !!item
	const [form, setForm] = useState<PresetItemFormState>(EMPTY_FORM)
	const [errors, setErrors] = useState<FormErrors>({})
	const contentRef = useRef<PresetContentEditorHandle>(null)

	useEffect(() => {
		if (open) {
			setForm(item ? itemToForm(item) : EMPTY_FORM)
			setErrors({})
		}
	}, [open, item])

	function handleAddOption() {
		const newOpt: FormOptionItem = { _key: genKey(), value: "", label: "" }
		setForm((prev) => ({ ...prev, options: [...prev.options, newOpt] }))
		setErrors((prev) => ({ ...prev, options: undefined }))
	}

	function handleUpdateOption(idx: number, patch: Partial<OptionItem>) {
		setForm((prev) => {
			const options = prev.options.map((opt, i) => (i === idx ? { ...opt, ...patch } : opt))
			return { ...prev, options }
		})
	}

	function handleDeleteOption(idx: number) {
		setForm((prev) => {
			const deleted = prev.options[idx]
			const options = prev.options.filter((_, i) => i !== idx)
			const default_key = prev.default_key === deleted?._key ? "" : prev.default_key
			return { ...prev, options, default_key }
		})
	}

	function handleSetDefault(optKey: string, isDefault: boolean) {
		setForm((prev) => ({ ...prev, default_key: isDefault ? optKey : "" }))
	}

	function handleLabelChange(v: LocaleText) {
		setForm((prev) => ({ ...prev, label: v }))
		if (!isLabelEmpty(v)) setErrors((prev) => ({ ...prev, label: undefined }))
	}

	function handleInsertPresetValue() {
		contentRef.current?.insertPresetValue()
	}

	const isValid = useMemo(
		() => !isLabelEmpty(form.label) && form.options.length > 0,
		[form.label, form.options.length],
	)

	function validate(): FormErrors {
		const next: FormErrors = {}
		if (isLabelEmpty(form.label)) next.label = t("playbook.edit.presets.form.errorNameRequired")
		if (form.options.length === 0)
			next.options = t("playbook.edit.presets.form.errorOptionRequired")
		return next
	}

	function handleConfirm() {
		const next = validate()
		if (Object.keys(next).length > 0) {
			setErrors(next)
			return
		}
		// Strip internal _key before passing to parent; resolve default_value from _key
		const options: OptionItem[] = form.options.map(
			(opt) =>
				Object.fromEntries(
					Object.entries(opt).filter(([key]) => key !== "_key"),
				) as OptionItem,
		)
		const defaultOpt = form.options.find((opt) => opt._key === form.default_key)
		onConfirm({
			label: form.label,
			options,
			default_value: defaultOpt?.value || undefined,
			preset_content: isLocaleTextEmpty(form.preset_content)
				? undefined
				: form.preset_content,
		})
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="!max-w-[672px] gap-0 p-0">
				<DialogHeader className="border-b px-3 py-3">
					<DialogTitle className="text-base font-semibold">
						{isEditing
							? t("playbook.edit.presets.form.titleEdit")
							: t("playbook.edit.presets.form.titleCreate")}
					</DialogTitle>
				</DialogHeader>

				<div className="flex max-h-[520px] flex-col gap-2.5 overflow-y-auto p-4">
					{/* Name row */}
					<FormRow label={t("playbook.edit.presets.form.name")} alignTop={!!errors.label}>
						<div className="flex flex-1 flex-col gap-1">
							<LocaleTextInput
								value={form.label}
								onChange={handleLabelChange}
								placeholder={t("playbook.edit.presets.form.namePlaceholder")}
								localizeLabel={t("playbook.edit.presets.form.name")}
								data-testid="preset-item-name-input"
							/>
							{errors.label && (
								<p
									className="text-xs text-destructive"
									data-testid="preset-item-name-error"
								>
									{errors.label}
								</p>
							)}
						</div>
					</FormRow>

					{/* Options section */}
					<div
						className={`flex flex-col gap-2 rounded-lg p-3.5 ${errors.options ? "bg-destructive/5 ring-1 ring-destructive/30" : "bg-secondary"}`}
					>
						<p className="text-base font-medium text-foreground">
							{t("playbook.edit.presets.form.optional")}
						</p>

						{form.options.length > 0 && (
							<table
								className="w-full table-fixed border-separate border-spacing-x-0 border-spacing-y-2"
								role="grid"
								aria-label={t("playbook.edit.presets.form.optional")}
								data-testid="preset-options-table"
							>
								<thead>
									<tr>
										<th className="w-[5rem] pb-2 text-left" scope="col" />
										<th className="w-24 min-w-[6rem] text-left" scope="col">
											<span className="text-xs text-muted-foreground">
												{t("playbook.edit.presets.form.setAsDefault")}
											</span>
										</th>
										<th className="min-w-[10rem] pr-2 text-left" scope="col">
											<span className="text-xs text-muted-foreground">
												{t("playbook.edit.presets.form.displayName")}
											</span>
										</th>
										<th className="min-w-[10rem] pr-2 text-left" scope="col">
											<span className="text-xs text-muted-foreground">
												{t("playbook.edit.presets.form.presetValue")}
											</span>
										</th>
										<th className="w-20 min-w-[5rem] text-left" scope="col">
											<span className="text-xs text-muted-foreground">
												{t("playbook.edit.presets.form.actions")}
											</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{form.options.map((opt, idx) => (
										<OptionRow
											key={opt._key}
											idx={idx}
											option={opt}
											isDefault={form.default_key === opt._key}
											onUpdate={(patch) => handleUpdateOption(idx, patch)}
											onDelete={() => handleDeleteOption(idx)}
											onSetDefault={(isDefault) =>
												handleSetDefault(opt._key, isDefault)
											}
										/>
									))}
								</tbody>
							</table>
						)}

						<button
							type="button"
							className="flex h-9 w-fit items-center gap-1 rounded-md border border-border bg-background px-4 py-2 text-sm text-primary hover:bg-accent hover:opacity-80"
							onClick={handleAddOption}
							data-testid="preset-item-add-option-btn"
						>
							<Plus className="h-4 w-4" />
							{t("playbook.edit.presets.form.addOption")}
						</button>
						{errors.options && (
							<p
								className="text-xs text-destructive"
								data-testid="preset-item-options-error"
							>
								{errors.options}
							</p>
						)}
					</div>

					{/* Preset Content */}
					<FormRow label={t("playbook.edit.presets.form.presetContent")} alignTop>
						<div className="flex flex-1 flex-col gap-2">
							<div className="flex items-center justify-between gap-3">
								<div className="flex w-full items-center justify-end gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="shadow-xs h-8 gap-2 px-3 text-xs font-medium text-foreground"
										onClick={handleInsertPresetValue}
										data-testid="preset-item-insert-preset-value-btn"
									>
										<CirclePlus className="h-4 w-4" />
										{t("playbook.edit.presets.form.insertPresetValue")}
									</Button>
									<Separator orientation="vertical" className="!h-5" />
									<PresetContentLocaleDialog
										value={form.preset_content}
										onChange={(preset_content) =>
											setForm((prev) => ({ ...prev, preset_content }))
										}
										placeholder={t(
											"playbook.edit.presets.form.presetContentPlaceholder",
										)}
										localizeLabel={t(
											"playbook.edit.presets.form.presetContent",
										)}
										data-testid="preset-item-content"
									/>
								</div>
							</div>
							<PresetContentEditor
								ref={contentRef}
								value={getRawLocaleValue(form.preset_content, DEFAULT_LOCALE_KEY)}
								onChange={(preset_content) =>
									setForm((prev) => ({
										...prev,
										preset_content: setLocaleValue(
											prev.preset_content,
											DEFAULT_LOCALE_KEY,
											preset_content,
										),
									}))
								}
								placeholder={t(
									"playbook.edit.presets.form.presetContentPlaceholder",
								)}
								data-testid="preset-item-content-textarea"
							/>
						</div>
					</FormRow>
				</div>

				<DialogFooter className="border-t px-3 py-3">
					<Button
						variant="outline"
						className="shadow-xs h-9"
						onClick={() => onOpenChange(false)}
						data-testid="preset-item-dialog-cancel"
					>
						{t("playbook.edit.presets.form.cancel")}
					</Button>
					<Button
						className="shadow-xs h-9"
						disabled={!isValid}
						onClick={handleConfirm}
						data-testid="preset-item-dialog-confirm"
					>
						{t("playbook.edit.presets.form.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

// ─── OptionRow ────────────────────────────────────────────────────────────────

interface OptionRowProps {
	idx: number
	option: FormOptionItem
	isDefault: boolean
	onUpdate: (patch: Partial<OptionItem>) => void
	onDelete: () => void
	onSetDefault: (isDefault: boolean) => void
}

function OptionRow({ idx, option, isDefault, onUpdate, onDelete, onSetDefault }: OptionRowProps) {
	const { t } = useTranslation("crew/create")
	return (
		<tr className="align-top" data-testid={`preset-option-row-${option._key}`}>
			<td className="w-[5rem] pr-2 align-middle">
				<button
					type="button"
					className="flex cursor-grab touch-none items-center gap-1 text-muted-foreground active:cursor-grabbing"
					aria-hidden="true"
				>
					<GripVertical className="h-4 w-4" />
					{t("playbook.edit.presets.form.optionLabel", { number: idx + 1 })}
				</button>
			</td>
			<td className="w-24 min-w-[6rem] pr-2 align-middle">
				<Switch
					checked={isDefault}
					onCheckedChange={onSetDefault}
					data-testid={`preset-option-default-${option._key}`}
				/>
			</td>
			<td className="min-w-[10rem] pr-2 align-middle">
				<LocaleTextInput
					value={option.label ?? ""}
					onChange={(label) => onUpdate({ label })}
					placeholder={t("playbook.edit.presets.form.displayName")}
					data-testid={`preset-option-label-${option._key}`}
				/>
			</td>
			<td className="min-w-[10rem] pr-2 align-middle">
				<LocaleTextInput
					value={option.value}
					onChange={(value) => onUpdate({ value })}
					placeholder={t("playbook.edit.presets.form.presetValue")}
					data-testid={`preset-option-value-${option._key}`}
				/>
			</td>
			<td className="w-20 min-w-[5rem] align-middle">
				<Button
					className="h-9 w-9 bg-background text-destructive hover:bg-destructive/10 hover:text-destructive"
					onClick={onDelete}
					data-testid={`preset-option-delete-${option._key}`}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</td>
		</tr>
	)
}

// ─── FormRow ──────────────────────────────────────────────────────────────────

interface FormRowProps {
	label: string
	alignTop?: boolean
	children: React.ReactNode
}

function FormRow({ label, alignTop = false, children }: FormRowProps) {
	return (
		<div className={`flex w-full gap-2 ${alignTop ? "items-start" : "items-center"}`}>
			<div className="flex h-9 w-[140px] shrink-0 items-center">
				<span className="text-base font-medium text-foreground">{label}</span>
			</div>
			{children}
		</div>
	)
}
