import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { X } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import PlaybackTabContent, {
	type PlaybackTabContentProps,
} from "../../../components/Detail/components/FilesViewer/components/PlaybackTabContent"

type PlaybackContext = Omit<
	PlaybackTabContentProps,
	"disPlayDetail" | "userSelectDetail" | "setUserSelectDetail" | "attachmentList"
> & {
	/** The project's flat file list, as the detail panel hands it to the playback tab. */
	attachmentList?: unknown[]
}

interface AiCanvasPlaybackPanelProps extends PlaybackContext {
	/** Tool step shown; opening another playback replaces it, so only the latest stays. */
	detail: unknown
	onDetailChange: (detail: unknown) => void
	onClose: () => void
}

/**
 * Tool playback of an AI canvas project, floated over the canvas's right side instead of taking
 * the detail panel's place (the canvas page shows no tabs to come back from a playback tab).
 * It reuses the playback tab's content; stepping through the playback updates `detail`. Closes
 * from the top-right button or Escape.
 */
function AiCanvasPlaybackPanel({
	detail,
	onDetailChange,
	onClose,
	attachmentList,
	...context
}: AiCanvasPlaybackPanelProps) {
	const { t } = useTranslation("aiCanvas")
	const closeLabel = t("project.closePlayback")

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !event.defaultPrevented) onClose()
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [onClose])

	return (
		<div
			className="absolute bottom-3 right-3 top-3 flex w-[min(640px,calc(100%-24px))] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_24px_64px_-24px_rgb(15_23_42/0.35)]"
			role="dialog"
			aria-label={t("project.playbackTitle")}
			data-testid="ai-canvas-playback-panel"
		>
			<div className="flex h-10 shrink-0 items-center justify-between border-b border-border pl-4 pr-2">
				<span className="text-sm font-medium text-foreground">
					{t("project.playbackTitle")}
				</span>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-7 text-muted-foreground"
					onClick={onClose}
					aria-label={closeLabel}
					title={closeLabel}
					data-testid="ai-canvas-playback-close"
				>
					<X size={16} />
				</Button>
			</div>
			<div className="min-h-0 flex-1 overflow-hidden">
				<PlaybackTabContent
					{...context}
					// Same loosely typed list the detail panel forwards to its playback tab.
					attachmentList={attachmentList as PlaybackTabContentProps["attachmentList"]}
					disPlayDetail={detail}
					userSelectDetail={detail}
					setUserSelectDetail={onDetailChange}
				/>
			</div>
		</div>
	)
}

export default AiCanvasPlaybackPanel
