import { FilePenLine, WandSparkles, ListMinus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import PPTNotesCustomAction from "./PPTNotesCustomAction"

export type PPTNotesAction = "generate" | "polish" | "shorten" | "custom"

export default function PPTNotesActions({
	onAction,
	hasNotes,
	disabled,
}: {
	onAction: (action: PPTNotesAction, instruction?: string) => void
	hasNotes: boolean
	disabled: boolean
}) {
	const { t } = useTranslation("super")
	const actions = [
		{ action: "generate" as const, label: t("ppt.speakerNotes.generate"), icon: FilePenLine },
		{ action: "polish" as const, label: t("ppt.speakerNotes.polish"), icon: WandSparkles },
		{ action: "shorten" as const, label: t("ppt.speakerNotes.shorten"), icon: ListMinus },
	]
	return (
		<>
			{actions.map(({ action, label, icon: Icon }) => (
				<Button
					key={action}
					type="button"
					variant="ghost"
					size="sm"
					className="h-6 gap-1.5 rounded-md px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
					disabled={disabled || (action !== "generate" && !hasNotes)}
					onClick={() => onAction(action)}
				>
					<Icon className="size-4" />
					{label}
				</Button>
			))}
			<PPTNotesCustomAction
				disabled={disabled || !hasNotes}
				onSubmit={(instruction) => onAction("custom", instruction)}
			/>
		</>
	)
}
