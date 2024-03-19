import { useTranslation } from "react-i18next"
import { Button } from "@/opensource/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/opensource/components/shadcn-ui/dialog"

interface IdentityPromptDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	value: string
	onChange: (value: string) => void
	onSave: () => void
}

export function IdentityPromptDialog({
	open,
	onOpenChange,
	value,
	onChange,
	onSave,
}: IdentityPromptDialogProps) {
	const { t } = useTranslation("crew/create")

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{t("card.prompt")}</DialogTitle>
				</DialogHeader>
				<textarea
					value={value}
					onChange={(e) => onChange(e.target.value)}
					rows={8}
					className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
					data-testid="crew-member-prompt-textarea"
				/>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{t("card.cancel")}
					</Button>
					<Button onClick={onSave}>{t("card.save")}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
