import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"

interface ImportSkillPublishPromptDialogProps {
	skillCode: string | null
	onOpenChange: (open: boolean) => void
}

function ImportSkillPublishPromptDialog({
	skillCode,
	onOpenChange,
}: ImportSkillPublishPromptDialogProps) {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()

	const handlePublishNow = useCallback(() => {
		if (!skillCode) return

		navigate({
			name: RouteName.SkillEdit,
			params: { code: skillCode },
			query: {
				panel: "publish",
				publishView: "create",
			},
		})
		onOpenChange(false)
	}, [navigate, onOpenChange, skillCode])

	return (
		<AlertDialog open={!!skillCode} onOpenChange={onOpenChange}>
			<AlertDialogContent
				size="sm"
				className="w-[384px] !max-w-[384px] gap-0 p-0"
				data-testid="import-skill-publish-prompt-dialog"
			>
				<AlertDialogHeader className="gap-1.5 px-4 py-4 text-left">
					<AlertDialogTitle>{t("importSkill.publishPrompt.title")}</AlertDialogTitle>
					<AlertDialogDescription>
						{t("importSkill.publishPrompt.description")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter className="mx-0 mb-0 flex flex-row justify-end gap-2 rounded-b-xl border-t bg-muted p-4">
					<AlertDialogCancel
						size="sm"
						className="min-w-0"
						data-testid="import-skill-publish-prompt-cancel"
					>
						{t("importSkill.publishPrompt.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						size="sm"
						className="min-w-0"
						onClick={handlePublishNow}
						data-testid="import-skill-publish-prompt-confirm"
					>
						{t("importSkill.publishPrompt.confirm")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

export default ImportSkillPublishPromptDialog
