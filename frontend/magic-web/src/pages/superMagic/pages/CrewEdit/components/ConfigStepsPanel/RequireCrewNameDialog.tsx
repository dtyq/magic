import { memo, useEffect, useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Input } from "@/components/shadcn-ui/input"
import { Button } from "@/components/shadcn-ui/button"

interface RequireCrewNameDialogProps {
	open: boolean
	initialName: string
	onOpenChange: (open: boolean) => void
	onConfirm: (name: string) => Promise<boolean>
}

function RequireCrewNameDialog({
	open,
	initialName,
	onOpenChange,
	onConfirm,
}: RequireCrewNameDialogProps) {
	const { t } = useTranslation("crew/create")
	const [name, setName] = useState(initialName)
	const [showError, setShowError] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	useEffect(() => {
		if (!open) return
		setName(initialName)
		setShowError(false)
		setIsSubmitting(false)
	}, [open, initialName])

	async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
		event?.preventDefault()

		const nextName = name.trim()
		if (!nextName) {
			setShowError(true)
			return
		}

		setIsSubmitting(true)
		const isSuccess = await onConfirm(nextName)
		if (!isSuccess) setIsSubmitting(false)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="w-[420px] !max-w-[420px] gap-0 p-0"
				showCloseButton={false}
				data-testid="crew-publish-name-dialog"
			>
				<form onSubmit={handleSubmit}>
					<DialogHeader className="gap-1 border-b border-border px-4 py-3 text-left">
						<DialogTitle className="text-base font-semibold">
							{t("publishNameDialog.title")}
						</DialogTitle>
						<DialogDescription>{t("publishNameDialog.description")}</DialogDescription>
					</DialogHeader>
					<div className="space-y-2 px-4 py-4" data-testid="crew-publish-name-field">
						<div className="text-sm font-medium">
							{t("card.localizeDialog.tabName")}
						</div>
						<Input
							value={name}
							onChange={(event) => {
								setName(event.target.value)
								if (showError && event.target.value.trim()) setShowError(false)
							}}
							placeholder={t("publishNameDialog.placeholder")}
							aria-invalid={showError}
							maxLength={20}
							autoFocus
							data-testid="crew-publish-name-input"
						/>
						{showError && (
							<p
								className="text-sm text-destructive"
								data-testid="crew-publish-name-error"
							>
								{t("publishNameDialog.required")}
							</p>
						)}
					</div>
					<DialogFooter className="border-t border-border px-4 py-3">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							data-testid="crew-publish-name-cancel-button"
						>
							{t("card.cancel")}
						</Button>
						<Button
							type="submit"
							disabled={isSubmitting}
							data-testid="crew-publish-name-confirm-button"
						>
							{isSubmitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
							{t("publishNameDialog.confirm")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}

export default memo(RequireCrewNameDialog)
