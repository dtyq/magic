import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Textarea } from "@/components/shadcn-ui/textarea"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"

interface Props {
	open: boolean
	onOpenChange: (open: boolean) => void
	onCreate: (prompt: string) => Promise<boolean>
	onCloseAutoFocus: () => void
}

export default function MicroAppSkillCreateDialog({
	open,
	onOpenChange,
	onCreate,
	onCloseAutoFocus,
}: Props) {
	const { t } = useTranslation("super")
	const [requirement, setRequirement] = useState("")
	const [submitting, setSubmitting] = useState(false)
	const [failed, setFailed] = useState(false)
	const pending = useRef(false)

	async function submit() {
		if (!requirement.trim() || pending.current) return
		pending.current = true
		setSubmitting(true)
		setFailed(false)
		try {
			const accepted = await onCreate(
				t("microAppPage.skills.createPrompt", { requirement: requirement.trim() }),
			)
			if (accepted) {
				setRequirement("")
				onOpenChange(false)
			} else setFailed(true)
		} catch {
			setFailed(true)
		} finally {
			pending.current = false
			setSubmitting(false)
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(value) => {
				if (!pending.current) onOpenChange(value)
			}}
		>
			<DialogContent
				className="sm:max-w-lg"
				showCloseButton={!submitting}
				onCloseAutoFocus={(event) => {
					event.preventDefault()
					onCloseAutoFocus()
				}}
			>
				<DialogHeader>
					<DialogTitle>{t("microAppPage.skills.create")}</DialogTitle>
					<DialogDescription>
						{t("microAppPage.skills.createDescription")}
					</DialogDescription>
				</DialogHeader>
				<label className="space-y-2 text-sm">
					<span>{t("microAppPage.skills.requirement")}</span>
					<Textarea
						autoFocus
						rows={6}
						value={requirement}
						disabled={submitting}
						onChange={(event) => setRequirement(event.target.value)}
						placeholder={t("microAppPage.skills.requirementPlaceholder")}
					/>
				</label>
				{failed ? (
					<p role="alert" className="text-sm text-destructive">
						{t("microAppPage.skills.createFailed")}
					</p>
				) : null}
				<DialogFooter>
					<Button
						variant="outline"
						disabled={submitting}
						onClick={() => onOpenChange(false)}
					>
						{t("microAppPage.skills.cancel")}
					</Button>
					<Button
						disabled={submitting || !requirement.trim()}
						onClick={() => void submit()}
					>
						{submitting ? (
							<Loader2 className="size-4 animate-spin" aria-hidden />
						) : null}
						{t("microAppPage.skills.createSubmit")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
