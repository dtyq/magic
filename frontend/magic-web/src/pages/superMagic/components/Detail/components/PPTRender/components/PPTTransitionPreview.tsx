import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import IsolatedHTMLRenderer from "../../../contents/HTML/IsolatedHTMLRenderer"
import { resolvePptScaleContentDimensions } from "../../../contents/HTML/utils/slide-dimensions"
import type { SlideItem } from "../PPTSidebar/types"
import type { PPTTransition } from "../utils/pptTransitions"
import { animatePPTTransition } from "../utils/pptTransitionAnimation"

export interface PPTTransitionPreviewSlide extends SlideItem {
	fileId?: string
	htmlRelativeFolderPath?: string
}

export interface PPTTransitionPreviewSource {
	current?: PPTTransitionPreviewSlide
	previous?: PPTTransitionPreviewSlide
	filePathMapping?: Map<string, string>
	projectId?: string
}

const emptyMapping = new Map<string, string>()
const ignoreNavigation = () => undefined

function PreviewPage({
	slide,
	filePathMapping,
	projectId,
	onReady,
}: {
	slide: PPTTransitionPreviewSlide
	filePathMapping: Map<string, string>
	projectId?: string
	onReady: () => void
}) {
	const dimensions = useMemo(
		() => resolvePptScaleContentDimensions(slide.content, slide.rawContent),
		[slide.content, slide.rawContent],
	)
	return (
		<IsolatedHTMLRenderer
			content={slide.content || ""}
			rawSourceCode={slide.rawContent}
			sandboxType="iframe"
			isPptRender
			isEditMode={false}
			isTabActive={false}
			isPlaybackPaused
			disableIframeDocumentClickBridge
			scaleContentDimensions={dimensions}
			autoFitScalePaddingFactor={1}
			autoFitVerticalPadding={0}
			filePathMapping={filePathMapping}
			fileId={slide.fileId}
			htmlRelativeFolderPath={slide.htmlRelativeFolderPath}
			projectId={projectId}
			openNewTab={ignoreNavigation}
			className="h-full w-full"
			onRenderReady={onReady}
		/>
	)
}

export default function PPTTransitionPreview({
	transition,
	run,
	reducedMotion,
	source,
	onReadyChange,
}: {
	transition: PPTTransition
	run: number
	reducedMotion: boolean
	source?: PPTTransitionPreviewSource
	onReadyChange?: (ready: boolean) => void
}) {
	const { t } = useTranslation("super")
	const { current, previous, filePathMapping = emptyMapping, projectId } = source ?? {}
	const previousRef = useRef<HTMLDivElement>(null)
	const nextRef = useRef<HTMLDivElement>(null)
	const playedRun = useRef(run)
	// A ready callback from an older document cannot enable playback of a newly selected page.
	const currentRevision = useMemo(
		() => ({ path: current?.path, content: current?.content }),
		[current?.path, current?.content],
	)
	const previousRevision = useMemo(
		() => ({ path: previous?.path, content: previous?.content }),
		[previous?.path, previous?.content],
	)
	const [currentReady, setCurrentReady] = useState<object>()
	const [previousReady, setPreviousReady] = useState<object>()
	const failed = current?.loadingState === "error" || previous?.loadingState === "error"
	const ready = Boolean(
		!failed &&
		current?.content &&
		currentReady === currentRevision &&
		(!previous || (previous.content && previousReady === previousRevision)),
	)
	const dimensions = useMemo(
		() => resolvePptScaleContentDimensions(current?.content, current?.rawContent),
		[current?.content, current?.rawContent],
	)
	useEffect(() => {
		onReadyChange?.(ready)
	}, [ready, onReadyChange])
	useEffect(() => {
		// Reopening the sheet or changing system motion preferences must not autoplay.
		if (playedRun.current === run) return
		playedRun.current = run
		const previous = previousRef.current
		const next = nextRef.current
		if (!run || reducedMotion || !ready || !previous || !next) return
		// Preview and presentation share the same fixed effect implementation.
		previous.style.visibility = "visible"
		const animation = animatePPTTransition(previous, next, transition)
		let cancelled = false
		void animation.finished.then(() => {
			if (cancelled) return
			previous.style.visibility = "hidden"
			animation.cancel()
		})
		return () => {
			cancelled = true
			animation.cancel()
			previous.style.visibility = "hidden"
		}
	}, [run, reducedMotion, transition, ready, currentRevision, previousRevision])
	return (
		<figure className="space-y-2">
			<div
				className="pointer-events-none relative overflow-hidden rounded-lg border bg-background"
				style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
				data-testid="ppt-transition-preview"
				aria-hidden="true"
				// Real iframes render normally, while inert keeps links and keyboard input in the editor.
				{...{ inert: "" }}
			>
				<div
					ref={previousRef}
					className="invisible absolute inset-0 bg-background"
					data-slide-path={previous?.path}
				>
					{previous?.content && (
						<PreviewPage
							key={previous.path}
							slide={previous}
							filePathMapping={filePathMapping}
							projectId={projectId}
							onReady={() => setPreviousReady(previousRevision)}
						/>
					)}
				</div>
				<div
					ref={nextRef}
					className="absolute inset-0 bg-background"
					data-slide-path={current?.path}
				>
					{current?.content && (
						<PreviewPage
							key={current.path}
							slide={current}
							filePathMapping={filePathMapping}
							projectId={projectId}
							onReady={() => setCurrentReady(currentRevision)}
						/>
					)}
				</div>
				{!ready && (
					<div className="absolute inset-0 flex items-center justify-center bg-background/90 p-3 text-center text-xs text-muted-foreground">
						{failed
							? t("ppt.transitions.previewFailed")
							: t("ppt.transitions.previewLoading")}
					</div>
				)}
			</div>
			<figcaption className="text-xs text-muted-foreground">
				{previous
					? t("ppt.transitions.previewPages", {
							from: previous.index + 1,
							to: (current?.index ?? 0) + 1,
						})
					: t("ppt.transitions.previewCurrent", { page: (current?.index ?? 0) + 1 })}
			</figcaption>
		</figure>
	)
}
