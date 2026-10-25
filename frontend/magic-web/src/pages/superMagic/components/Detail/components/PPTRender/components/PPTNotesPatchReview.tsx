import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import type { Editor } from "@/infrastructure/editors/tiptap/core"
import type { AiPatchState } from "@/components/tiptap-node/ai-patch"

const ACTION_CLASS = "h-6 rounded-md px-2 text-xs font-normal"
const ACCEPT_CLASS = `${ACTION_CLASS} text-foreground hover:bg-accent`
const REJECT_CLASS = `${ACTION_CLASS} text-muted-foreground hover:text-foreground`

export default function PPTNotesPatchReview({
	editor,
	patchState,
	readOnly,
}: {
	editor: Editor | null
	patchState: AiPatchState | undefined
	readOnly: boolean
}) {
	const { t } = useTranslation("super")
	return (
		<>
			{Boolean(patchState?.patches.length) && patchState?.phase === "review" && (
				<div
					className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2"
					role="group"
					aria-label={t("ppt.speakerNotes.reviewChanges")}
				>
					<span className="mr-auto text-xs text-muted-foreground">
						{t("ppt.speakerNotes.pendingChanges", {
							count: patchState?.patches.length,
						})}
					</span>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className={ACCEPT_CLASS}
						disabled={readOnly}
						onClick={() => editor?.commands.acceptAiPatch(patchState?.patches[0]?.id)}
					>
						{t("ppt.speakerNotes.acceptChange")}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className={REJECT_CLASS}
						onClick={() => editor?.commands.rejectAiPatch(patchState?.patches[0]?.id)}
					>
						{t("ppt.speakerNotes.rejectChange")}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className={ACCEPT_CLASS}
						disabled={readOnly}
						onClick={() => editor?.commands.acceptAiPatch()}
					>
						{t("ppt.speakerNotes.acceptAllChanges")}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className={REJECT_CLASS}
						onClick={() => editor?.commands.rejectAiPatch()}
					>
						{t("ppt.speakerNotes.rejectAllChanges")}
					</Button>
				</div>
			)}
			{/* The notice only matters while suggestions remain; it clears once all are resolved. */}
			{Boolean(patchState?.invalidatedCount) && Boolean(patchState?.patches.length) && (
				<p role="status" className="px-3 py-1 text-xs text-muted-foreground">
					{t("ppt.speakerNotes.patchConflict")}
				</p>
			)}
		</>
	)
}
