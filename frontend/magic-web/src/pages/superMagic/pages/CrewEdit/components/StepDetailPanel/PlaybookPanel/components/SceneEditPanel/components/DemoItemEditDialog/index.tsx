import { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { CirclePlus } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
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
	LocaleText,
	OptionGroup,
	OptionItem,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { resolveLocalText } from "../../utils"
import { LocaleTextInput } from "../LocaleTextInput"
import { ImageUploadField, type ImageMetadata } from "../ImageUploadField"
import { DemoGroupEditDialog } from "../DemoGroupEditDialog"

interface DemoItemFormState {
	thumbnail_url: string
	label: LocaleText
	description: LocaleText
	group_key: string
	width?: number
	height?: number
	aspect_ratio?: number
}

interface DemoItemEditDialogProps {
	/** The item to edit. When undefined a "Create" dialog is shown. */
	item?: OptionItem
	/** Default group_key when creating */
	defaultGroupKey?: string
	groups: OptionGroup[]
	open: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: (data: Partial<OptionItem>, groupKey: string) => void
	/**
	 * Called when user creates a new group inline.
	 * Returns the new group's key so it can be auto-selected.
	 */
	onCreateGroup?: (data: { group_name: LocaleText; group_icon?: string }) => string
}

const EMPTY_FORM: DemoItemFormState = {
	thumbnail_url: "",
	label: "",
	description: "",
	group_key: "",
}

function itemToForm(item: OptionItem, defaultGroupKey: string): DemoItemFormState {
	return {
		thumbnail_url: item.thumbnail_url ?? "",
		label: item.label ?? "",
		description: item.description ?? "",
		group_key: defaultGroupKey,
		width: item.width,
		height: item.height,
		aspect_ratio: item.aspect_ratio,
	}
}

function isLocaleFilled(text: LocaleText): boolean {
	if (typeof text === "string") return text.trim().length > 0
	return Object.values(text as Record<string, string>).some((v) => v && v.trim().length > 0)
}

export function DemoItemEditDialog({
	item,
	defaultGroupKey = "",
	groups,
	open,
	onOpenChange,
	onConfirm,
	onCreateGroup,
}: DemoItemEditDialogProps) {
	const { t, i18n } = useTranslation("crew/create")
	const isEditing = !!item
	const [form, setForm] = useState<DemoItemFormState>(EMPTY_FORM)
	const [groupDialogOpen, setGroupDialogOpen] = useState(false)
	const [isUploading, setIsUploading] = useState(false)

	useEffect(() => {
		if (open) {
			setForm(
				item
					? itemToForm(item, defaultGroupKey)
					: { ...EMPTY_FORM, group_key: defaultGroupKey },
			)
			setIsUploading(false)
		}
	}, [open, item, defaultGroupKey])

	const isValid = useMemo(() => {
		const groupValid = groups.length === 0 || !!form.group_key
		return isLocaleFilled(form.label) && isLocaleFilled(form.description) && groupValid
	}, [form.label, form.description, form.group_key, groups.length])

	function handleImageMetadataChange(metadata?: ImageMetadata) {
		setForm((prev) => ({
			...prev,
			width: metadata?.width,
			height: metadata?.height,
			aspect_ratio: metadata?.aspectRatio,
		}))
	}

	function handleConfirm() {
		onConfirm(
			{
				thumbnail_url: form.thumbnail_url || undefined,
				label: form.label,
				description: form.description,
				width: form.width,
				height: form.height,
				aspect_ratio: form.aspect_ratio,
			},
			form.group_key,
		)
		onOpenChange(false)
	}

	function handleGroupConfirm(data: { group_name: LocaleText; group_icon?: string }) {
		if (!onCreateGroup) return
		const newGroupKey = onCreateGroup(data)
		setForm((prev) => ({ ...prev, group_key: newGroupKey }))
	}

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-[640px] gap-0 p-0">
					<DialogHeader className="border-b px-3 py-3">
						<DialogTitle className="text-base font-semibold">
							{isEditing
								? t("playbook.edit.inspiration.item.titleEdit")
								: t("playbook.edit.inspiration.item.titleCreate")}
						</DialogTitle>
					</DialogHeader>

					<div className="flex flex-col gap-2.5 overflow-y-auto p-4">
						{/* Cover Image row */}
						<FormRow label={t("playbook.edit.inspiration.item.coverImage")} alignTop>
							<ImageUploadField
								value={form.thumbnail_url}
								onChange={(url) =>
									setForm((prev) => ({ ...prev, thumbnail_url: url }))
								}
								onMetadataChange={handleImageMetadataChange}
								onUploadingChange={setIsUploading}
								buttonLabel={t("playbook.edit.inspiration.item.upload")}
								emptyText={t("playbook.edit.inspiration.item.noCoverAvailable")}
								successToast={t("playbook.edit.inspiration.item.uploadSuccess")}
								failToast={t("playbook.edit.inspiration.item.uploadFail")}
								previewClassName="h-32 w-32 rounded-sm"
								uploadBtnTestId="demo-item-upload-btn"
							/>
						</FormRow>

						{/* Title row */}
						<FormRow label={t("playbook.edit.inspiration.item.title")} required>
							<LocaleTextInput
								value={form.label}
								onChange={(v) => setForm((prev) => ({ ...prev, label: v }))}
								placeholder={t("playbook.edit.inspiration.item.titlePlaceholder")}
								localizeLabel={t("playbook.edit.inspiration.item.title")}
								data-testid="demo-item-title-input"
							/>
						</FormRow>

						{/* Prompt row */}
						<FormRow
							label={t("playbook.edit.inspiration.item.prompt")}
							alignTop
							required
						>
							<LocaleTextInput
								value={form.description}
								onChange={(v) => setForm((prev) => ({ ...prev, description: v }))}
								placeholder={t("playbook.edit.inspiration.item.promptPlaceholder")}
								localizeLabel={t("playbook.edit.inspiration.item.prompt")}
								multiline
								data-testid="demo-item-prompt-input"
							/>
						</FormRow>

						{/* Group row */}
						{groups.length > 0 && (
							<FormRow label={t("playbook.edit.inspiration.item.group")} required>
								<div className="flex flex-1 items-center gap-1.5">
									<Select
										value={form.group_key}
										onValueChange={(v) =>
											setForm((prev) => ({ ...prev, group_key: v }))
										}
									>
										<SelectTrigger
											className="shadow-xs h-9 w-[200px]"
											data-testid="demo-item-group-select"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{groups.map((g) => (
												<SelectItem key={g.group_key} value={g.group_key}>
													{resolveLocalText(g.group_name, i18n.language)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{onCreateGroup && (
										<Button
											variant="outline"
											size="icon"
											className="shadow-xs h-9 w-9 shrink-0"
											onClick={() => setGroupDialogOpen(true)}
											data-testid="demo-item-create-group-btn"
										>
											<CirclePlus className="h-4 w-4" />
										</Button>
									)}
								</div>
							</FormRow>
						)}
					</div>

					<DialogFooter className="border-t px-3 py-3">
						<Button
							variant="outline"
							className="shadow-xs h-9"
							onClick={() => onOpenChange(false)}
							data-testid="demo-item-dialog-cancel"
						>
							{t("playbook.edit.inspiration.item.cancel")}
						</Button>
						<Button
							className="shadow-xs h-9"
							disabled={!isValid || isUploading}
							onClick={handleConfirm}
							data-testid="demo-item-dialog-confirm"
						>
							{t("playbook.edit.inspiration.item.confirm")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{onCreateGroup && (
				<DemoGroupEditDialog
					open={groupDialogOpen}
					onOpenChange={setGroupDialogOpen}
					onConfirm={handleGroupConfirm}
				/>
			)}
		</>
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
