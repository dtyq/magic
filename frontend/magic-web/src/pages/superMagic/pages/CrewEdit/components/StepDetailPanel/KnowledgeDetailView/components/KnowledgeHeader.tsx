import { memo } from "react"
import { useTranslation } from "react-i18next"
import { FileText, X, FlaskConical } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import type { KnowledgeHeaderProps } from "../types"

/**
 * Knowledge detail header component
 * Displays knowledge name with icon, recall test button, and close button
 *
 * @param knowledgeName - Name of the knowledge base
 * @param onClose - Callback when close button is clicked
 * @param onRecallTest - Optional callback when recall test button is clicked
 * @param showRecallTestButton - Whether to show the recall test button
 * @param disableRecallTest - Whether to disable the recall test button
 */
export const KnowledgeHeader = memo(function KnowledgeHeader({
	knowledgeName,
	onClose,
	onRecallTest,
	showRecallTestButton = false,
	disableRecallTest = false,
}: KnowledgeHeaderProps) {
	const { t } = useTranslation("crew/create")

	return (
		<div className="flex shrink-0 flex-col gap-3 pb-3">
			<div className="flex w-full items-center gap-2">
				<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-300/25 dark:bg-blue-500/15">
					<FileText className="size-4 text-[#3B82F6]" aria-hidden />
				</div>
				<h2 className="min-w-0 flex-1 truncate text-base font-medium leading-normal text-foreground">
					{knowledgeName || t("knowledgeDetail.untitled")}
				</h2>
				{showRecallTestButton && onRecallTest && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 shrink-0 gap-1.5"
						onClick={onRecallTest}
						disabled={disableRecallTest}
					>
						<FlaskConical className="size-4" />
						<span>{t("recallTest.button")}</span>
					</Button>
				)}
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-8 shrink-0"
					onClick={onClose}
					aria-label={t("common.close")}
				>
					<X className="size-6" />
				</Button>
			</div>
			<Separator />
		</div>
	)
})
