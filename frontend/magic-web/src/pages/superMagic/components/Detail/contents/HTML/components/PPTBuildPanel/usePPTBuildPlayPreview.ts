import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import type { HTMLEditorV2Ref } from "../../iframe-bridge/types/props"

/** Stand-in for the presenter's click on a step that waits for one. */
export const PLAY_CLICK_GAP_MS = 900
/** A step's reveal animation finishes before an automatic step starts, as in a presentation. */
export const PLAY_SETTLE_MS = 250
const PLAY_HOLD_MS = 800

/**
 * Plays the slide's steps on the editing canvas: click steps advance after a short pause, and
 * automatic steps keep their own delay. `delays` lists, per display step, its automatic delay
 * in ms or null when it waits for a click.
 */
export function usePPTBuildPlayPreview(
	editorRef: RefObject<HTMLEditorV2Ref>,
	delays: Array<number | null>,
) {
	const [playing, setPlaying] = useState(false)
	const run = useRef(0)
	const latestDelays = useRef(delays)
	latestDelays.current = delays

	const stop = useCallback(async () => {
		run.current += 1
		setPlaying(false)
		await editorRef.current?.previewPPTBuild(null).catch(() => {
			/* The iframe may already have been disposed. */
		})
	}, [editorRef])

	const play = useCallback(async () => {
		const editor = editorRef.current
		const steps = latestDelays.current
		if (!editor || !steps.length) return
		const id = ++run.current
		const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
		setPlaying(true)
		try {
			await editor.previewPPTBuild(0)
			for (let index = 1; index <= steps.length; index += 1) {
				const delay = steps[index - 1]
				await wait(delay === null ? PLAY_CLICK_GAP_MS : PLAY_SETTLE_MS + delay)
				if (run.current !== id) return
				await editor.previewPPTBuild(index, true)
			}
			await wait(PLAY_HOLD_MS)
		} catch {
			/* A disposed slide or a failed request simply ends the playback. */
		} finally {
			if (run.current === id) {
				setPlaying(false)
				await editor.previewPPTBuild(null).catch(() => {
					/* The iframe may already have been disposed. */
				})
			}
		}
	}, [editorRef])

	useEffect(
		() => () => {
			run.current += 1
		},
		[],
	)
	return { playing, play, stop }
}
