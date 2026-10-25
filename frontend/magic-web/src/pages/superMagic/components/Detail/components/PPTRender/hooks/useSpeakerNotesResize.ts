import { useLayoutEffect, useRef, useState } from "react"
import type { KeyboardEvent, PointerEvent } from "react"
import { reaction } from "mobx"
import { pptNotesPreferenceStore } from "@/stores/layout/PPTNotesPreferenceStore"
import {
	clampSpeakerNotesHeight,
	getSpeakerNotesInFlowHeight,
	isSpeakerNotesOverlay,
	SPEAKER_NOTES_FALLBACK_PARENT_HEIGHT,
} from "../utils/speakerNotesLayout"

export function useSpeakerNotesResize() {
	const panelRef = useRef<HTMLElement>(null)
	const dragRef = useRef<{ y: number; height: number } | null>(null)
	const [height, setHeight] = useState(pptNotesPreferenceStore.height)
	const [parentHeight, setParentHeight] = useState(SPEAKER_NOTES_FALLBACK_PARENT_HEIGHT)
	const heightRef = useRef(height)

	useLayoutEffect(() => reaction(() => pptNotesPreferenceStore.height, setHeight), [])

	useLayoutEffect(() => {
		const parent = panelRef.current?.parentElement
		if (!parent) return

		function syncParentHeight() {
			if (parent.clientHeight > 0) setParentHeight(parent.clientHeight)
		}

		syncParentHeight()
		const observer = new ResizeObserver(syncParentHeight)
		observer.observe(parent)
		return () => observer.disconnect()
	}, [])

	function resize(nextHeight: number) {
		const liveParentHeight = panelRef.current?.parentElement?.clientHeight || parentHeight
		heightRef.current = clampSpeakerNotesHeight(nextHeight, liveParentHeight)
		setHeight(heightRef.current)
		if (liveParentHeight > 0) setParentHeight(liveParentHeight)
	}

	function finishResize() {
		if (!dragRef.current) return
		dragRef.current = null
		// Persist once per gesture, avoiding synchronous storage writes on every pointer move.
		pptNotesPreferenceStore.setHeight(heightRef.current)
	}

	function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
		if (event.button !== 0) return
		dragRef.current = {
			y: event.clientY,
			height: panelRef.current?.getBoundingClientRect().height || height,
		}
		heightRef.current = height
		// Capture keeps resizing active when the pointer crosses the slide iframe.
		event.currentTarget.setPointerCapture(event.pointerId)
	}

	function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
		if (!dragRef.current) return
		resize(dragRef.current.height + dragRef.current.y - event.clientY)
	}

	function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
		if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
		event.preventDefault()
		// Arrow keys resize this panel instead of triggering window-level slide navigation.
		event.stopPropagation()
		resize(height + (event.key === "ArrowUp" ? 20 : -20))
		pptNotesPreferenceStore.setHeight(heightRef.current)
	}

	const displayHeight = clampSpeakerNotesHeight(height, parentHeight)

	return {
		panelRef,
		height: displayHeight,
		overlay: isSpeakerNotesOverlay(displayHeight, parentHeight),
		inFlowHeight: getSpeakerNotesInFlowHeight(displayHeight, parentHeight),
		resizeHandleProps: {
			onPointerDown,
			onPointerMove,
			onPointerUp: finishResize,
			onPointerCancel: finishResize,
			onLostPointerCapture: finishResize,
			onKeyDown,
		},
	}
}
