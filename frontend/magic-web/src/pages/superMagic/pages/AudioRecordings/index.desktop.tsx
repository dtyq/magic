import { useRef } from "react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import AudioRecordingsDesktop from "./AudioRecordingsDesktop"

/** Page shell for PC audio recordings list (CrewMarket-style layout) */
function AudioRecordingsPageDesktop() {
	const scrollViewportRef = useRef<HTMLDivElement | null>(null)

	return (
		<div
			className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs"
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
		</div>
	)
}

export default AudioRecordingsPageDesktop
