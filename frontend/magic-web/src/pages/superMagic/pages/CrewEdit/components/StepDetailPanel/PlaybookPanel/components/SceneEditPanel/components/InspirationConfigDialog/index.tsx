import { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Grid, LayoutDashboard, List } from "lucide-react"
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
	DemoPanelConfig,
	LocaleText,
	OptionViewType,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { LocaleTextInput } from "../LocaleTextInput"

interface InspirationConfigFormState {
	title: LocaleText
	view_type: OptionViewType | ""
}

interface InspirationConfigDialogProps {
	config?: DemoPanelConfig
	open: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: (updated: { title: LocaleText; view_type?: OptionViewType }) => void
}

const EMPTY_FORM: InspirationConfigFormState = {
	title: "",
	view_type: "",
}

function configToForm(config: DemoPanelConfig): InspirationConfigFormState {
	return {
		title: config.title ?? "",
		view_type: config.demo?.view_type ?? "",
	}
}

export function InspirationConfigDialog({
	config,
	open,
	onOpenChange,
	onConfirm,
}: InspirationConfigDialogProps) {
	const { t } = useTranslation("crew/create")
	const [form, setForm] = useState<InspirationConfigFormState>(EMPTY_FORM)

	useEffect(() => {
		if (open) setForm(config ? configToForm(config) : EMPTY_FORM)
	}, [open, config])

	const isValid = true

	function handleConfirm() {
		onConfirm({
			title: form.title,
			view_type: form.view_type ? (form.view_type as OptionViewType) : undefined,
		})
		onOpenChange(false)
	}

	const themeOptions: { value: string; label: string; icon?: React.ReactNode }[] = useMemo(
		() => [
			{
				value: "text_list",
				label: t("playbook.edit.inspiration.config.themeOptions.textList"),
				icon: <List className="h-4 w-4" />,
			},
			{
				value: "grid",
				label: t("playbook.edit.inspiration.config.themeOptions.grid"),
				icon: <Grid className="h-4 w-4" />,
			},
			{
				value: "waterfall",
				label: t("playbook.edit.inspiration.config.themeOptions.waterfall"),
				icon: <LayoutDashboard className="h-4 w-4" />,
			},
		],
		[t],
	)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[576px] gap-0 p-0">
				<DialogHeader className="border-b px-3 py-3">
					<DialogTitle className="text-base font-semibold">
						{t("playbook.edit.inspiration.config.title")}
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-2.5 p-4">
					{/* Title row */}
					<FormRow label={t("playbook.edit.inspiration.config.panelTitle")}>
						<LocaleTextInput
							value={form.title}
							onChange={(v) => setForm((prev) => ({ ...prev, title: v }))}
							placeholder={t(
								"playbook.edit.inspiration.config.panelTitlePlaceholder",
							)}
							localizeLabel={t("playbook.edit.inspiration.config.panelTitle")}
							data-testid="inspiration-config-title-input"
						/>
					</FormRow>

					{/* Theme row */}
					<FormRow label={t("playbook.edit.inspiration.config.theme")}>
						<div className="flex flex-1 items-center">
							<Select
								value={form.view_type}
								onValueChange={(v) =>
									setForm((prev) => ({ ...prev, view_type: v as OptionViewType }))
								}
							>
								<SelectTrigger
									className="shadow-xs h-9 w-[200px]"
									data-testid="inspiration-config-theme-select"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{themeOptions.map((opt) => (
										<SelectItem key={opt.value} value={opt.value}>
											<div className="flex items-center gap-2">
												{opt.icon}
												{opt.label}
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</FormRow>
				</div>

				<DialogFooter className="border-t px-3 py-3">
					<Button
						variant="outline"
						className="shadow-xs h-9"
						onClick={() => onOpenChange(false)}
						data-testid="inspiration-config-cancel"
					>
						{t("playbook.edit.inspiration.config.cancel")}
					</Button>
					<Button
						className="shadow-xs h-9"
						disabled={!isValid}
						onClick={handleConfirm}
						data-testid="inspiration-config-confirm"
					>
						{t("playbook.edit.inspiration.config.confirm")}
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
