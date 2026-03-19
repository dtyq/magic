import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { X } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import type {
	GuidePanelConfig,
	LocaleText,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { LocaleTextInput } from "../LocaleTextInput"

interface QuickStartConfigFormState {
	title: LocaleText
}

interface QuickStartConfigDialogProps {
	config?: GuidePanelConfig
	open: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: (updated: { title: LocaleText }) => void
}

const EMPTY_FORM: QuickStartConfigFormState = {
	title: "",
}

function configToForm(config: GuidePanelConfig): QuickStartConfigFormState {
	return {
		title: config.title ?? "",
	}
}

function isLocaleFilled(text: LocaleText): boolean {
	if (typeof text === "string") return text.trim().length > 0
	return Object.values(text as Record<string, string>).some((value) => value.trim().length > 0)
}

export function QuickStartConfigDialog({
	config,
	open,
	onOpenChange,
	onConfirm,
}: QuickStartConfigDialogProps) {
	const { t } = useTranslation("crew/create")
	const [form, setForm] = useState<QuickStartConfigFormState>(EMPTY_FORM)

	useEffect(() => {
		if (open) setForm(config ? configToForm(config) : EMPTY_FORM)
	}, [open, config])

	const isValid = useMemo(() => isLocaleFilled(form.title), [form.title])

	function handleConfirm() {
		if (!isValid) return
		onConfirm({ title: form.title })
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="w-[534px] max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 shadow-sm"
				data-testid="quickstart-config-dialog"
			>
				<DialogHeader className="flex-row items-start border-b px-3 py-3">
					<DialogTitle className="text-base font-semibold leading-6">
						{t("playbook.edit.quickStart.config.title")}
					</DialogTitle>
					<DialogClose
						className="ml-auto rounded-xs text-muted-foreground transition-colors hover:text-foreground"
						data-testid="quickstart-config-close"
					>
						<span className="sr-only">
							{t("playbook.edit.quickStart.config.cancel")}
						</span>
						<X className="h-4 w-4" />
					</DialogClose>
				</DialogHeader>

				<div className="flex flex-col gap-2.5 p-4">
					<FormRow label={t("playbook.edit.quickStart.config.panelTitle")}>
						<div className="w-[364px] max-w-full shrink-0">
							<LocaleTextInput
								value={form.title}
								onChange={(value) => setForm((prev) => ({ ...prev, title: value }))}
								placeholder={t(
									"playbook.edit.quickStart.config.panelTitlePlaceholder",
								)}
								localizeLabel={t("playbook.edit.quickStart.config.panelTitle")}
								className="w-[320px] flex-none"
								data-testid="quickstart-config-title-input"
							/>
						</div>
					</FormRow>
				</div>

				<DialogFooter className="border-t px-3 py-3">
					<Button
						variant="outline"
						className="shadow-xs h-9"
						onClick={() => onOpenChange(false)}
						data-testid="quickstart-config-cancel"
					>
						{t("playbook.edit.quickStart.config.cancel")}
					</Button>
					<Button
						className="shadow-xs h-9"
						disabled={!isValid}
						onClick={handleConfirm}
						data-testid="quickstart-config-confirm"
					>
						{t("playbook.edit.quickStart.config.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

interface FormRowProps {
	label: string
	children: React.ReactNode
}

function FormRow({ label, children }: FormRowProps) {
	return (
		<div className="flex w-full items-start gap-2">
			<div className="flex h-9 min-w-0 flex-1 items-center">
				<span className="text-base font-medium text-foreground">{label}</span>
			</div>
			{children}
		</div>
	)
}
