import { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Textarea } from "@/components/shadcn-ui/textarea"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import type {
	ClickActionType,
	ExecutionMethodType,
	GuideItem,
	LocaleText,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { LocaleTextInput } from "../LocaleTextInput"
import { ImageUploadField } from "../ImageUploadField"

interface GuideItemFormState {
	icon: string
	title: LocaleText
	description: LocaleText
	click_action: ClickActionType
	preset_content: string
	url: string
	execution_method: ExecutionMethodType
}

interface GuideItemEditDialogProps {
	/** The item to edit. When undefined a "Create" dialog is shown. */
	item?: GuideItem
	open: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: (updated: Partial<GuideItem>) => void
}

const EMPTY_FORM: GuideItemFormState = {
	icon: "",
	title: "",
	description: "",
	click_action: "no_action",
	preset_content: "",
	url: "",
	execution_method: "send_immediately",
}

function itemToForm(item: GuideItem): GuideItemFormState {
	return {
		icon: item.icon ?? "",
		title: item.title ?? "",
		description: item.description ?? "",
		click_action: item.click_action ?? "no_action",
		preset_content: item.preset_content ?? "",
		url: item.url ?? "",
		execution_method: item.execution_method ?? "send_immediately",
	}
}

function isLocaleFilled(text: LocaleText): boolean {
	if (typeof text === "string") return text.trim().length > 0
	return Object.values(text as Record<string, string>).some((v) => v && v.trim().length > 0)
}

/** Whether the selected action requires a Preset Content field */
function needsPresetContent(action: ClickActionType): boolean {
	return action === "ai_enhancement" || action === "fill_content"
}

/** Whether the selected action requires a URL field */
function needsUrl(action: ClickActionType): boolean {
	return action === "open_url"
}

/** Whether the selected action requires an Execution Method field */
function needsExecutionMethod(action: ClickActionType): boolean {
	return action === "ai_enhancement" || action === "fill_content"
}

export function GuideItemEditDialog({
	item,
	open,
	onOpenChange,
	onConfirm,
}: GuideItemEditDialogProps) {
	const { t } = useTranslation("crew/create")
	const isEditing = !!item
	const [form, setForm] = useState<GuideItemFormState>(EMPTY_FORM)
	const [isUploading, setIsUploading] = useState(false)

	useEffect(() => {
		if (open) {
			setForm(item ? itemToForm(item) : EMPTY_FORM)
			setIsUploading(false)
		}
	}, [open, item])

	function patch<K extends keyof GuideItemFormState>(key: K, value: GuideItemFormState[K]) {
		setForm((prev) => ({ ...prev, [key]: value }))
	}

	const isValid = useMemo(() => {
		if (!isLocaleFilled(form.title)) return false
		if (!isLocaleFilled(form.description)) return false
		if (needsUrl(form.click_action) && !form.url.trim()) return false
		if (needsPresetContent(form.click_action) && !isLocaleFilled(form.preset_content))
			return false
		return true
	}, [form.title, form.description, form.click_action, form.url, form.preset_content])

	function handleConfirm() {
		onConfirm({
			icon: form.icon,
			title: form.title,
			description: form.description,
			click_action: form.click_action,
			preset_content: needsPresetContent(form.click_action) ? form.preset_content : undefined,
			url: needsUrl(form.click_action) ? form.url : undefined,
			execution_method: needsExecutionMethod(form.click_action)
				? form.execution_method
				: undefined,
		})
		onOpenChange(false)
	}

	const clickActionOptions: { value: ClickActionType; label: string }[] = [
		{ value: "no_action", label: t("playbook.edit.quickStart.form.clickActions.noAction") },
		{ value: "focus_input", label: t("playbook.edit.quickStart.form.clickActions.focusInput") },
		{
			value: "ai_enhancement",
			label: t("playbook.edit.quickStart.form.clickActions.aiEnhancement"),
		},
		{
			value: "fill_content",
			label: t("playbook.edit.quickStart.form.clickActions.fillContent"),
		},
		{ value: "open_url", label: t("playbook.edit.quickStart.form.clickActions.openUrl") },
		{ value: "upload_file", label: t("playbook.edit.quickStart.form.clickActions.uploadFile") },
	]

	const executionMethodOptions: { value: ExecutionMethodType; label: string }[] = [
		{
			value: "send_immediately",
			label: t("playbook.edit.quickStart.form.executionMethods.sendImmediately"),
		},
		{
			value: "insert_to_input",
			label: t("playbook.edit.quickStart.form.executionMethods.insertToInput"),
		},
	]

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[576px] gap-0 p-0">
				<DialogHeader className="border-b px-3 py-3">
					<DialogTitle className="text-base font-semibold">
						{isEditing
							? t("playbook.edit.quickStart.form.titleEdit")
							: t("playbook.edit.quickStart.form.titleCreate")}
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-2.5 overflow-y-auto p-4">
					{/* Icon row */}
					<FormRow label={t("playbook.edit.quickStart.form.icon")}>
						<ImageUploadField
							value={form.icon}
							onChange={(url) => patch("icon", url)}
							onUploadingChange={setIsUploading}
							buttonLabel={t("playbook.edit.quickStart.form.upload")}
							emptyText={t("playbook.edit.quickStart.form.iconEmpty")}
							emptySubText={t("playbook.edit.quickStart.form.iconSize")}
							successToast={t("playbook.edit.quickStart.form.uploadSuccess")}
							failToast={t("playbook.edit.quickStart.form.uploadFail")}
							previewClassName="size-32 rounded-sm"
							uploadBtnTestId="guide-item-upload-btn"
						/>
					</FormRow>

					{/* Title row */}
					<FormRow label={t("playbook.edit.quickStart.form.title")} required>
						<LocaleTextInput
							value={form.title}
							onChange={(v) => patch("title", v)}
							placeholder={t("playbook.edit.quickStart.form.titlePlaceholder")}
							localizeLabel={t("playbook.edit.quickStart.form.title")}
							data-testid="guide-item-title-input"
						/>
					</FormRow>

					{/* Description row */}
					<FormRow
						label={t("playbook.edit.quickStart.form.description")}
						alignTop
						required
					>
						<LocaleTextInput
							value={form.description}
							onChange={(v) => patch("description", v)}
							placeholder={t("playbook.edit.quickStart.form.descriptionPlaceholder")}
							localizeLabel={t("playbook.edit.quickStart.form.description")}
							multiline
							data-testid="guide-item-description-input"
						/>
					</FormRow>

					{/* Click Action row */}
					<FormRow label={t("playbook.edit.quickStart.form.clickAction")}>
						<div className="flex flex-1 items-center gap-1.5">
							<Select
								value={form.click_action}
								onValueChange={(v) => patch("click_action", v as ClickActionType)}
							>
								<SelectTrigger
									className="shadow-xs h-9 w-[200px]"
									data-testid="guide-item-click-action-select"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{clickActionOptions.map((opt) => (
										<SelectItem key={opt.value} value={opt.value}>
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</FormRow>

					{/* URL — only for open_url */}
					{needsUrl(form.click_action) && (
						<FormRow label={t("playbook.edit.quickStart.form.url")} alignTop required>
							<Textarea
								value={form.url}
								onChange={(e) => patch("url", e.target.value)}
								placeholder={t("playbook.edit.quickStart.form.urlPlaceholder")}
								className="shadow-xs h-9 flex-1"
								data-testid="guide-item-url-input"
							/>
						</FormRow>
					)}

					{/* Preset Content — for ai_enhancement / fill_content */}
					{needsPresetContent(form.click_action) && (
						<FormRow
							label={t("playbook.edit.quickStart.form.presetContent")}
							alignTop
							required
						>
							<LocaleTextInput
								value={form.preset_content}
								onChange={(v) => patch("preset_content", v as string)}
								placeholder={t(
									"playbook.edit.quickStart.form.presetContentPlaceholder",
								)}
								localizeLabel={t("playbook.edit.quickStart.form.presetContent")}
								multiline
								data-testid="guide-item-preset-content-input"
							/>
						</FormRow>
					)}

					{/* Execution Method — for ai_enhancement / fill_content */}
					{needsExecutionMethod(form.click_action) && (
						<FormRow label={t("playbook.edit.quickStart.form.executionMethod")}>
							<div className="flex flex-1 items-center gap-1.5">
								<Select
									value={form.execution_method}
									onValueChange={(v) =>
										patch("execution_method", v as ExecutionMethodType)
									}
								>
									<SelectTrigger
										className="shadow-xs h-9 w-[200px]"
										data-testid="guide-item-execution-method-select"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{executionMethodOptions.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</FormRow>
					)}
				</div>

				<DialogFooter className="border-t px-3 py-3">
					<Button
						variant="outline"
						className="shadow-xs h-9"
						onClick={() => onOpenChange(false)}
						data-testid="guide-item-dialog-cancel"
					>
						{t("playbook.edit.quickStart.form.cancel")}
					</Button>
					<Button
						className="shadow-xs h-9"
						disabled={!isValid || isUploading}
						onClick={handleConfirm}
						data-testid="guide-item-dialog-confirm"
					>
						{t("playbook.edit.quickStart.form.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

interface FormRowProps {
	label: string
	alignTop?: boolean
	required?: boolean
	children: React.ReactNode
}

function FormRow({ label, alignTop = false, required = false, children }: FormRowProps) {
	return (
		<div className={`flex w-full gap-2 ${alignTop ? "items-start" : "items-center"}`}>
			<div className="flex h-9 w-[140px] shrink-0 items-center gap-0.5">
				{required && <span className="text-destructive">*</span>}
				<span className="text-base font-medium text-foreground">{label}</span>
			</div>
			{children}
		</div>
	)
}
