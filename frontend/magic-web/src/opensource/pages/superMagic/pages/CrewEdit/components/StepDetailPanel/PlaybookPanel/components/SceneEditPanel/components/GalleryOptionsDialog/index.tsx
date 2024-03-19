import { useState, useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { CirclePlus } from "lucide-react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/opensource/components/shadcn-ui/dialog"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/opensource/components/shadcn-ui/select"
import { Separator } from "@/opensource/components/shadcn-ui/separator"
import { DEFAULT_LOCALE_KEY } from "@/opensource/pages/superMagic/components/MainInputContainer/panels/types"
import type {
	FieldItem,
	LocaleText,
	OptionItem,
} from "@/opensource/pages/superMagic/components/MainInputContainer/panels/types"
import TemplateViewSwitcher from "@/opensource/pages/superMagic/components/MainInputContainer/panels/TemplateViewSwitcher"
import { resolveLocalText } from "../../utils"
import { LocaleTextInput, setLocaleValue } from "../LocaleTextInput"
import { ImageUploadField, type ImageMetadata } from "../ImageUploadField"
import {
	PresetContentEditor,
	type PresetContentEditorHandle,
} from "../PresetItemEditDialog/PresetContentEditor"
import { PresetContentLocaleDialog } from "../PresetItemEditDialog/PresetContentLocaleDialog"

/** Sentinel used for the "no default" Select option (empty string is not valid in Radix). */
const NO_DEFAULT = "__none__"

interface GalleryOptionsDialogProps {
	galleryItem?: FieldItem
	open: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: (data: {
		label: LocaleText
		options: OptionItem[]
		default_value?: string
		preset_content?: LocaleText
	}) => void
}

interface GalleryOptionItem extends Omit<OptionItem, "value"> {
	value: string
}

function isLocaleFilled(text: LocaleText): boolean {
	if (typeof text === "string") return text.trim().length > 0
	return Object.values(text as Record<string, string>).some((v) => v && v.trim().length > 0)
}

function resolveOptionValue(value?: LocaleText): string {
	return resolveLocalText(value ?? "", "default").trim()
}

function normalizeGalleryOptionItem(item: OptionItem): GalleryOptionItem {
	return {
		...item,
		value: resolveOptionValue(item.value),
	}
}

export function GalleryOptionsDialog({
	galleryItem,
	open,
	onOpenChange,
	onConfirm,
}: GalleryOptionsDialogProps) {
	const { t, i18n } = useTranslation("crew/create")
	const contentRef = useRef<PresetContentEditorHandle>(null)

	const [label, setLabel] = useState<LocaleText>("")
	const [items, setItems] = useState<GalleryOptionItem[]>([])
	const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
	const [defaultValue, setDefaultValue] = useState<string>("")
	const [presetContent, setPresetContent] = useState<LocaleText>("")

	// Item edit sub-dialog state
	const [itemDialogOpen, setItemDialogOpen] = useState(false)
	const [editingItem, setEditingItem] = useState<GalleryOptionItem | undefined>(undefined)

	useEffect(() => {
		if (open) {
			setLabel(galleryItem?.label ?? "")
			setItems(
				((galleryItem?.options ?? []) as OptionItem[])
					.filter((opt): opt is OptionItem => !("group_key" in opt))
					.map(normalizeGalleryOptionItem),
			)
			setSelectedKeys(new Set())
			setDefaultValue(resolveOptionValue(galleryItem?.default_value))
			setPresetContent(galleryItem?.preset_content ?? "")
		}
	}, [open, galleryItem])

	const isValid = useMemo(() => isLocaleFilled(label), [label])

	function handleConfirm() {
		onConfirm({
			label,
			options: items,
			default_value: defaultValue || undefined,
			preset_content: isLocaleFilled(presetContent) ? presetContent : undefined,
		})
		onOpenChange(false)
	}

	function handleInsertPresetValue() {
		contentRef.current?.insertPresetValue()
	}

	function handleSelect(value: string, checked: boolean) {
		setSelectedKeys((prev) => {
			const next = new Set(prev)
			if (checked) next.add(value)
			else next.delete(value)
			return next
		})
	}

	function handleEdit(item: OptionItem) {
		setEditingItem(normalizeGalleryOptionItem(item))
		setItemDialogOpen(true)
	}

	function handleDelete(value: string) {
		setItems((prev) => prev.filter((item) => item.value !== value))
		setSelectedKeys((prev) => {
			const next = new Set(prev)
			next.delete(value)
			return next
		})
		if (defaultValue === value) setDefaultValue("")
	}

	function handleOpenCreate() {
		setEditingItem(undefined)
		setItemDialogOpen(true)
	}

	function handleItemConfirm(data: Partial<GalleryOptionItem>) {
		if (editingItem) {
			setItems((prev) =>
				prev.map((item) =>
					item.value === editingItem.value ? { ...item, ...data } : item,
				),
			)
			// Sync defaultValue if item's value key was renamed
			if (
				data.value &&
				data.value !== editingItem.value &&
				defaultValue === editingItem.value
			)
				setDefaultValue(resolveOptionValue(data.value))
		} else {
			const newItem: GalleryOptionItem = {
				...data,
				value: data.value?.trim() ?? Math.random().toString(36).slice(2),
			}
			setItems((prev) => [...prev, newItem])
		}
	}

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="flex max-h-[80vh] max-w-[560px] flex-col gap-0 p-0">
					<DialogHeader className="shrink-0 border-b px-3 py-3">
						<DialogTitle className="text-base font-semibold">
							{t("playbook.edit.presets.gallery.dialog.title")}
						</DialogTitle>
					</DialogHeader>

					<div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
						{/* Name */}
						<FormRow label={t("playbook.edit.presets.gallery.dialog.name")} required>
							<LocaleTextInput
								value={label}
								onChange={setLabel}
								placeholder={t(
									"playbook.edit.presets.gallery.dialog.namePlaceholder",
								)}
								localizeLabel={t("playbook.edit.presets.gallery.dialog.name")}
								data-testid="gallery-options-name-input"
							/>
						</FormRow>

						{/* Default value */}
						<FormRow label={t("playbook.edit.presets.gallery.dialog.defaultValue")}>
							<Select
								value={defaultValue || NO_DEFAULT}
								onValueChange={(v) => setDefaultValue(v === NO_DEFAULT ? "" : v)}
							>
								<SelectTrigger
									className="shadow-xs h-9 flex-1"
									data-testid="gallery-options-default-select"
								>
									<SelectValue
										placeholder={t(
											"playbook.edit.presets.gallery.dialog.defaultValuePlaceholder",
										)}
									/>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_DEFAULT}>
										{t("playbook.edit.presets.gallery.dialog.noDefault")}
									</SelectItem>
									{items.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{resolveLocalText(
												item.label ?? item.value,
												i18n.language,
											) || item.value}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FormRow>

						{/* Preset content */}
						<FormRow
							label={t("playbook.edit.presets.gallery.dialog.presetContent")}
							alignTop
						>
							<div className="flex flex-1 flex-col gap-2">
								<div className="flex items-center justify-between gap-3">
									<div className="flex w-full items-center justify-end gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="shadow-xs h-8 gap-2 px-3 text-xs font-medium text-foreground"
											onClick={handleInsertPresetValue}
											data-testid="gallery-options-insert-preset-value-btn"
										>
											<CirclePlus className="h-4 w-4" />
											{t("playbook.edit.presets.form.insertPresetValue")}
										</Button>
										<Separator orientation="vertical" className="!h-5" />
										<PresetContentLocaleDialog
											value={presetContent}
											onChange={setPresetContent}
											placeholder={t(
												"playbook.edit.presets.gallery.dialog.presetContentPlaceholder",
											)}
											localizeLabel={t(
												"playbook.edit.presets.gallery.dialog.presetContent",
											)}
											data-testid="gallery-options-preset-content"
										/>
									</div>
								</div>
								<PresetContentEditor
									ref={contentRef}
									value={resolveLocalText(presetContent, DEFAULT_LOCALE_KEY)}
									onChange={(nextValue) =>
										setPresetContent((prev) =>
											setLocaleValue(prev, DEFAULT_LOCALE_KEY, nextValue),
										)
									}
									placeholder={t(
										"playbook.edit.presets.gallery.dialog.presetContentPlaceholder",
									)}
									data-testid="gallery-options-preset-content-textarea"
								/>
							</div>
						</FormRow>

						{/* Items area */}
						<div className="flex flex-col gap-3 overflow-y-auto rounded-lg border border-border p-3">
							<Button
								className="shadow-xs h-9 w-full"
								onClick={handleOpenCreate}
								data-testid="gallery-options-add-btn"
							>
								<CirclePlus className="h-4 w-4" />
								{t("playbook.edit.presets.gallery.dialog.add")}
							</Button>

							{items.length > 0 && (
								<TemplateViewSwitcher
									mode="edit"
									viewType={
										"grid" as import("@/opensource/pages/superMagic/components/MainInputContainer/panels/types").OptionViewType
									}
									items={items}
									selectedKeys={selectedKeys}
									onSelect={handleSelect}
									onEdit={handleEdit}
									onDelete={handleDelete}
								/>
							)}
						</div>
					</div>

					<DialogFooter className="shrink-0 border-t px-3 py-3">
						<Button
							variant="outline"
							className="shadow-xs h-9"
							onClick={() => onOpenChange(false)}
							data-testid="gallery-options-cancel"
						>
							{t("playbook.edit.presets.gallery.dialog.cancel")}
						</Button>
						<Button
							className="shadow-xs h-9"
							disabled={!isValid}
							onClick={handleConfirm}
							data-testid="gallery-options-confirm"
						>
							{t("playbook.edit.presets.gallery.dialog.confirm")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<GalleryItemEditDialog
				item={editingItem}
				open={itemDialogOpen}
				onOpenChange={setItemDialogOpen}
				onConfirm={handleItemConfirm}
			/>
		</>
	)
}

// ─── GalleryItemEditDialog ────────────────────────────────────────────────────

interface GalleryItemFormState {
	value: string
	label: LocaleText
	thumbnail_url: string
	description: LocaleText
	sub_text: LocaleText
	width?: number
	height?: number
	aspect_ratio?: number
}

interface GalleryItemEditDialogProps {
	item?: GalleryOptionItem
	open: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: (data: Partial<GalleryOptionItem>) => void
}

const EMPTY_ITEM_FORM: GalleryItemFormState = {
	value: "",
	label: "",
	thumbnail_url: "",
	description: "",
	sub_text: "",
	width: undefined,
	height: undefined,
	aspect_ratio: undefined,
}

interface GalleryItemFormErrors {
	thumbnail_url?: string
	label?: string
	value?: string
}

/** Returns true when LocaleText has no non-empty value in any locale. */
function isLocaleTextEmpty(text: LocaleText): boolean {
	if (typeof text === "string") return text.trim().length === 0
	return Object.values(text as Record<string, string>).every((v) => !v || v.trim().length === 0)
}

function GalleryItemEditDialog({
	item,
	open,
	onOpenChange,
	onConfirm,
}: GalleryItemEditDialogProps) {
	const { t } = useTranslation("crew/create")
	const isEditing = !!item

	const [form, setForm] = useState<GalleryItemFormState>(EMPTY_ITEM_FORM)
	const [errors, setErrors] = useState<GalleryItemFormErrors>({})
	const [isUploading, setIsUploading] = useState(false)

	useEffect(() => {
		if (open) {
			setIsUploading(false)
			setForm(
				item
					? {
							value: item.value,
							label: item.label ?? "",
							thumbnail_url: item.thumbnail_url ?? "",
							description: item.description ?? "",
							sub_text: item.sub_text ?? "",
							width: item.width,
							height: item.height,
							aspect_ratio: item.aspect_ratio,
						}
					: EMPTY_ITEM_FORM,
			)
			setErrors({})
		}
	}, [open, item])

	const isValid = useMemo(
		() => !!form.thumbnail_url && !isLocaleTextEmpty(form.label) && !!form.value?.trim(),
		[form.thumbnail_url, form.label, form.value],
	)

	function validate(): boolean {
		const next: GalleryItemFormErrors = {}
		if (!form.thumbnail_url)
			next.thumbnail_url = t("playbook.edit.presets.gallery.item.errorCoverRequired")
		if (isLocaleTextEmpty(form.label))
			next.label = t("playbook.edit.presets.gallery.item.errorTitleRequired")
		if (!form.value?.trim())
			next.value = t("playbook.edit.presets.gallery.item.errorValueRequired")
		setErrors(next)
		return Object.keys(next).length === 0
	}

	function clearError(field: keyof GalleryItemFormErrors) {
		if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
	}

	function handleImageMetadataChange(metadata?: ImageMetadata) {
		setForm((prev) => ({
			...prev,
			width: metadata?.width,
			height: metadata?.height,
			aspect_ratio: metadata?.aspectRatio,
		}))
	}

	function handleConfirm() {
		if (!validate()) return
		onConfirm({
			value: form.value?.trim() || undefined,
			label: form.label,
			thumbnail_url: form.thumbnail_url || undefined,
			description: form.description || undefined,
			sub_text: form.sub_text || undefined,
			width: form.width,
			height: form.height,
			aspect_ratio: form.aspect_ratio,
		})
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[480px] gap-0 p-0">
				<DialogHeader className="border-b px-3 py-3">
					<DialogTitle className="text-base font-semibold">
						{isEditing
							? t("playbook.edit.presets.gallery.item.titleEdit")
							: t("playbook.edit.presets.gallery.item.titleCreate")}
					</DialogTitle>
				</DialogHeader>

				<div className="flex max-h-[520px] flex-col gap-2.5 overflow-y-auto p-4">
					{/* Cover Image */}
					<FormRow
						label={t("playbook.edit.presets.gallery.item.coverImage")}
						alignTop
						required
						error={errors.thumbnail_url}
					>
						<ImageUploadField
							value={form.thumbnail_url}
							onChange={(url) => {
								setForm((prev) => ({ ...prev, thumbnail_url: url }))
								clearError("thumbnail_url")
							}}
							onMetadataChange={handleImageMetadataChange}
							onUploadingChange={setIsUploading}
							buttonLabel={t("playbook.edit.presets.gallery.item.upload")}
							emptyText={t("playbook.edit.presets.gallery.item.noCover")}
							successToast={t("playbook.edit.presets.gallery.item.uploadSuccess")}
							failToast={t("playbook.edit.presets.gallery.item.uploadFail")}
							previewClassName="h-32 w-full min-w-[180px] rounded-md"
							uploadBtnTestId="gallery-item-upload-btn"
							error={errors.thumbnail_url}
						/>
					</FormRow>

					{/* Title */}
					<FormRow
						label={t("playbook.edit.presets.gallery.item.title")}
						required
						error={errors.label}
					>
						<LocaleTextInput
							value={form.label}
							onChange={(v) => {
								setForm((prev) => ({ ...prev, label: v }))
								clearError("label")
							}}
							placeholder={t("playbook.edit.presets.gallery.item.titlePlaceholder")}
							localizeLabel={t("playbook.edit.presets.gallery.item.title")}
							data-testid="gallery-item-title-input"
							error={errors.label}
						/>
					</FormRow>

					{/* Preset Value */}
					<FormRow
						label={t("playbook.edit.presets.gallery.item.value")}
						required
						error={errors.value}
					>
						<LocaleTextInput
							value={form.value}
							onChange={(v) => {
								setForm((prev) => ({
									...prev,
									value: resolveLocalText(v, "default"),
								}))
								clearError("value")
							}}
							placeholder={t("playbook.edit.presets.gallery.item.valuePlaceholder")}
							localizeLabel={t("playbook.edit.presets.gallery.item.value")}
							data-testid="gallery-item-value-input"
							error={errors.value}
						/>
					</FormRow>

					{/* Description */}
					<FormRow label={t("playbook.edit.presets.gallery.item.description")} alignTop>
						<LocaleTextInput
							value={form.description}
							onChange={(v) => setForm((prev) => ({ ...prev, description: v }))}
							placeholder={t(
								"playbook.edit.presets.gallery.item.descriptionPlaceholder",
							)}
							localizeLabel={t("playbook.edit.presets.gallery.item.description")}
							multiline
							data-testid="gallery-item-description-input"
						/>
					</FormRow>

					{/* Sub Text */}
					<FormRow label={t("playbook.edit.presets.gallery.item.subText")}>
						<LocaleTextInput
							value={form.sub_text}
							onChange={(v) => setForm((prev) => ({ ...prev, sub_text: v }))}
							placeholder={t("playbook.edit.presets.gallery.item.subTextPlaceholder")}
							localizeLabel={t("playbook.edit.presets.gallery.item.subText")}
							data-testid="gallery-item-subtext-input"
						/>
					</FormRow>
				</div>

				<DialogFooter className="border-t px-3 py-3">
					<Button
						variant="outline"
						className="shadow-xs h-9"
						onClick={() => onOpenChange(false)}
						data-testid="gallery-item-cancel"
					>
						{t("playbook.edit.presets.gallery.item.cancel")}
					</Button>
					<Button
						className="shadow-xs h-9"
						disabled={!isValid || isUploading}
						onClick={handleConfirm}
						data-testid="gallery-item-confirm"
					>
						{t("playbook.edit.presets.gallery.item.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

// ─── FormRow ──────────────────────────────────────────────────────────────────

interface FormRowProps {
	label: string
	alignTop?: boolean
	required?: boolean
	children: React.ReactNode
	error?: string
}

function FormRow({ label, alignTop = false, required = false, children, error }: FormRowProps) {
	return (
		<div className={`flex w-full gap-2 ${alignTop ? "items-start" : "items-center"}`}>
			<div className="flex h-9 w-[100px] shrink-0 items-center gap-0.5">
				{required && <span className="text-destructive">*</span>}
				<span className="text-base font-medium text-foreground">{label}</span>
			</div>
			<div className="flex flex-1 flex-col gap-1">
				{children}
				{error && <p className="text-xs text-destructive">{error}</p>}
			</div>
		</div>
	)
}
