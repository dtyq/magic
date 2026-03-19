import { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, Circle } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import type {
	LocaleText,
	OptionGroup,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { IconPickerPanel } from "../IconPickerPanel"
import { LocaleTextInput } from "../LocaleTextInput"

interface DemoGroupFormState {
	group_icon_name: string
	group_name: LocaleText
}

interface DemoGroupEditDialogProps {
	/** The group to edit. When undefined a "Create" dialog is shown. */
	group?: OptionGroup
	open: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: (data: { group_name: LocaleText; group_icon?: string }) => void
}

const EMPTY_FORM: DemoGroupFormState = {
	group_icon_name: "",
	group_name: "",
}

function groupToForm(group: OptionGroup): DemoGroupFormState {
	return {
		group_icon_name: group.group_icon ?? "",
		group_name: group.group_name ?? "",
	}
}

function isLocaleFilled(text: LocaleText): boolean {
	if (typeof text === "string") return text.trim().length > 0
	return Object.values(text as Record<string, string>).some((v) => v && v.trim().length > 0)
}

export function DemoGroupEditDialog({
	group,
	open,
	onOpenChange,
	onConfirm,
}: DemoGroupEditDialogProps) {
	const { t } = useTranslation("crew/create")
	const isEditing = !!group
	const [form, setForm] = useState<DemoGroupFormState>(EMPTY_FORM)

	useEffect(() => {
		if (open) setForm(group ? groupToForm(group) : EMPTY_FORM)
	}, [open, group])

	const isValid = useMemo(() => isLocaleFilled(form.group_name), [form.group_name])

	function handleConfirm() {
		onConfirm({
			group_name: form.group_name,
			group_icon: form.group_icon_name || undefined,
		})
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[576px] gap-0 p-0">
				<DialogHeader className="border-b px-3 py-3">
					<DialogTitle className="text-base font-semibold">
						{isEditing
							? t("playbook.edit.inspiration.group.titleEdit")
							: t("playbook.edit.inspiration.group.titleCreate")}
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-2.5 p-4">
					{/* Icon row */}
					<FormRow label={t("playbook.edit.inspiration.group.icon")}>
						<IconPickerPanel
							value={form.group_icon_name}
							onChange={(iconName) =>
								setForm((prev) => ({ ...prev, group_icon_name: iconName }))
							}
						>
							<span>
								<Button
									variant="outline"
									className="shadow-xs h-9 w-[72px] gap-1.5"
									data-testid="demo-group-icon-picker-trigger"
								>
									{form.group_icon_name ? (
										<LucideLazyIcon icon={form.group_icon_name} size={16} />
									) : (
										<Circle className="h-4 w-4" />
									)}
									<ChevronDown className="h-4 w-4" />
								</Button>
							</span>
						</IconPickerPanel>
					</FormRow>

					{/* Name row */}
					<FormRow label={t("playbook.edit.inspiration.group.name")} required>
						<LocaleTextInput
							value={form.group_name}
							onChange={(v) => setForm((prev) => ({ ...prev, group_name: v }))}
							placeholder={t("playbook.edit.inspiration.group.namePlaceholder")}
							localizeLabel={t("playbook.edit.inspiration.group.name")}
							data-testid="demo-group-name-input"
						/>
					</FormRow>
				</div>

				<DialogFooter className="border-t px-3 py-3">
					<Button
						variant="outline"
						className="shadow-xs h-9"
						onClick={() => onOpenChange(false)}
						data-testid="demo-group-dialog-cancel"
					>
						{t("playbook.edit.inspiration.group.cancel")}
					</Button>
					<Button
						className="shadow-xs h-9"
						disabled={!isValid}
						onClick={handleConfirm}
						data-testid="demo-group-dialog-confirm"
					>
						{t("playbook.edit.inspiration.group.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

interface FormRowProps {
	label: string
	required?: boolean
	children: React.ReactNode
}

function FormRow({ label, required = false, children }: FormRowProps) {
	return (
		<div className="flex w-full items-center gap-2">
			<div className="flex h-9 w-[140px] shrink-0 items-center gap-0.5">
				{required && <span className="text-destructive">*</span>}
				<span className="text-base font-medium text-foreground">{label}</span>
			</div>
			{children}
		</div>
	)
}
