import { useRef } from "react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"
import GuideTourWrapper from "@/pages/superMagic/components/LazyGuideTour"
import AudioRecordingsDesktop from "./AudioRecordingsDesktop"
import { RecordingGuideDemo } from "./components/recording-guide"
import { AUDIO_RECORDINGS_PAGE_SHELL_CLASS } from "./constants/page-shell"

/** Page shell for PC audio recordings list (CrewMarket-style layout) */
function AudioRecordingsPageDesktop() {
	const scrollViewportRef = useRef<HTMLDivElement | null>(null)

	return (
		<div
			// `relative` is for the staged tour view, which is laid inside this card rather than over
			// the whole window so the app around the page stays where it is.
			className={cn(AUDIO_RECORDINGS_PAGE_SHELL_CLASS, "relative")}
			data-testid="audio-recordings-page"
		>
			<ScrollArea
				className="min-h-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block"
				viewportRef={scrollViewportRef}
			>
				<div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-7">
					<AudioRecordingsDesktop scrollViewportRef={scrollViewportRef} />
				</div>
			</ScrollArea>

			{/*
			 * The "了解 AI 录音完成流程" steps are highlighted on this page, and it is a standalone route
			 * outside the home layout — so the tour has to be mounted here to serve that task. The
			 * staged session its later steps point at sits in the same card, one layer below the
			 * tour's own, and takes itself down when the run closes.
			 */}
			<RecordingGuideDemo />
			<GuideTourWrapper isMobile={false} page="recordings" />
		</div>
	)
}

export default AudioRecordingsPageDesktop
