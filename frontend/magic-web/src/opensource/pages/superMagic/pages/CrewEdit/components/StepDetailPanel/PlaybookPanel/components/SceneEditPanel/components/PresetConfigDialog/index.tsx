import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { LayoutGrid, SquareCheckBig, Tablet } from "lucide-react"
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
import {
	FieldPanelConfig,
	OptionViewType,
} from "@/opensource/pages/superMagic/components/MainInputContainer/panels/types"

interface PresetConfigFormState {
	view_type: OptionViewType
}

interface PresetConfigDialogProps {
	config?: FieldPanelConfig
	open: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: (data: { view_type?: OptionViewType }) => void
}

const EMPTY_FORM: PresetConfigFormState = {
	view_type: OptionViewType.DROPDOWN,
}

function configToForm(config: FieldPanelConfig): PresetConfigFormState {
	return {
		view_type: config.field?.view_type ?? OptionViewType.DROPDOWN,
	}
}

export function PresetConfigDialog({
	config,
	open,
	onOpenChange,
	onConfirm,
}: PresetConfigDialogProps) {
	const { t } = useTranslation("crew/create")
	const [form, setForm] = useState<PresetConfigFormState>(EMPTY_FORM)

	useEffect(() => {
		if (open) setForm(config ? configToForm(config) : EMPTY_FORM)
	}, [open, config])

	function handleConfirm() {
		onConfirm({ view_type: form.view_type || undefined })
		onOpenChange(false)
	}

	const themeOptions: { value: string; label: string; icon: React.ReactNode }[] = [
		{
			value: "dropdown",
			label: t("playbook.edit.presets.config.themeOptions.dropdown"),
			icon: <SquareCheckBig className="h-4 w-4" />,
		},
		{
			value: "grid",
			label: t("playbook.edit.presets.config.themeOptions.grid"),
			icon: <LayoutGrid className="h-4 w-4" />,
		},
		{
			value: "capsule",
			label: t("playbook.edit.presets.config.themeOptions.capsule"),
			icon: <Tablet className="h-4 w-4" />,
		},
	]

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[512px] gap-0 p-0">
				<DialogHeader className="border-b px-3 py-3">
					<DialogTitle className="text-base font-semibold">
						{t("playbook.edit.presets.config.title")}
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-2.5 p-4">
					<div className="flex w-full items-center gap-2">
						<div className="flex h-9 w-[140px] shrink-0 items-center">
							<span className="text-base font-medium text-foreground">
								{t("playbook.edit.presets.config.theme")}
							</span>
						</div>
						<div className="flex flex-1 items-center">
							<Select
								value={form.view_type}
								onValueChange={(v) => setForm({ view_type: v as OptionViewType })}
							>
								<SelectTrigger
									className="shadow-xs h-9 w-[200px]"
									data-testid="preset-config-theme-select"
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
					</div>
				</div>

				<DialogFooter className="border-t px-3 py-3">
					<Button
						variant="outline"
						className="shadow-xs h-9"
						onClick={() => onOpenChange(false)}
						data-testid="preset-config-cancel"
					>
						{t("playbook.edit.presets.config.cancel")}
					</Button>
					<Button
						className="shadow-xs h-9"
						onClick={handleConfirm}
						data-testid="preset-config-confirm"
					>
						{t("playbook.edit.presets.config.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
