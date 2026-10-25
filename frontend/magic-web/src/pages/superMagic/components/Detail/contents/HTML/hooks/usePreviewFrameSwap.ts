import { useLayoutEffect, useMemo, useRef, useState } from "react"

/**
 * A preview frame is one live iframe host. Replacing an iframe destroys the
 * document on screen before its successor has painted, which shows as a flash.
 * The swap keeps the previous frame mounted (frozen) until the next one reports
 * that it has rendered, so the viewer never sees an empty gap.
 */
export interface PreviewFrame<P> {
	id: number
	content: string
	/** Props captured when the frame stopped being live; null while live. */
	frozenProps: P | null
}

export interface PreviewFrameSwapState<P> {
	token: string
	frames: PreviewFrame<P>[]
	liveId: number | null
	readyId: number | null
	nextId: number
}

export interface PreviewFrameSwapInput<P> {
	/** Changing the token discards every frame, e.g. another file. */
	token: string
	content: string
	isEditing: boolean
	/** True while `content` still is the editor variant of the document. */
	contentIsEditVariant: boolean
	latestProps: P | null
}

export function createFrameSwapState<P>(token: string, content: string): PreviewFrameSwapState<P> {
	return {
		token,
		frames: [{ id: 0, content, frozenProps: null }],
		liveId: 0,
		readyId: null,
		nextId: 1,
	}
}

function freezeLive<P>(
	state: PreviewFrameSwapState<P>,
	latestProps: P | null,
): PreviewFrameSwapState<P> {
	if (state.liveId === null || latestProps === null) return state
	return {
		...state,
		liveId: null,
		frames: state.frames.map((frame) =>
			frame.id === state.liveId ? { ...frame, frozenProps: latestProps } : frame,
		),
	}
}

function appendLive<P>(state: PreviewFrameSwapState<P>, content: string): PreviewFrameSwapState<P> {
	return {
		...state,
		frames: [...state.frames, { id: state.nextId, content, frozenProps: null }],
		liveId: state.nextId,
		readyId: null,
		nextId: state.nextId + 1,
	}
}

function updateLiveContent<P>(
	state: PreviewFrameSwapState<P>,
	content: string,
): PreviewFrameSwapState<P> {
	return {
		...state,
		readyId: null,
		frames: state.frames.map((frame) =>
			frame.id === state.liveId ? { ...frame, content } : frame,
		),
	}
}

function reviveLastFrame<P>(state: PreviewFrameSwapState<P>): PreviewFrameSwapState<P> {
	const last = state.frames[state.frames.length - 1]
	return {
		...state,
		liveId: last.id,
		frames: state.frames.map((frame) =>
			frame.id === last.id ? { ...frame, frozenProps: null } : frame,
		),
	}
}

/** Pure transition used during render; returns `state` itself when settled. */
export function reconcileFrameSwap<P>(
	state: PreviewFrameSwapState<P>,
	input: PreviewFrameSwapInput<P>,
): PreviewFrameSwapState<P> {
	const { token, content, isEditing, contentIsEditVariant, latestProps } = input
	if (state.token !== token) return createFrameSwapState(token, content)

	if (isEditing) {
		const next = state.liveId === null ? reviveLastFrame(state) : state
		const live = next.frames.find((frame) => frame.id === next.liveId)
		if (!live || live.content === content) return next
		// A rendered document must never be rewritten in place: document.open/write reuses
		// the Window, so top-level let/const/class in page scripts throw on the second run
		// and scroll-reveal content stays hidden. Build the new document in a fresh frame
		// and keep the old one on screen until it has painted. Frames that have not
		// rendered yet have no script state worth preserving and are still updated in place.
		if (next.readyId === live.id) return appendLive(freezeLive(next, latestProps), content)
		return updateLiveContent(next, content)
	}

	const live = state.frames.find((frame) => frame.id === state.liveId)
	if (!live) return contentIsEditVariant ? state : appendLive(state, content)

	// Leaving the editor: hold the frame on screen until the reprocessed
	// (non-editor) document exists, instead of rebuilding it with stale content.
	if (contentIsEditVariant) {
		return state.readyId === live.id ? freezeLive(state, latestProps) : state
	}

	if (live.content === content) return state
	if (state.readyId === live.id) return appendLive(freezeLive(state, latestProps), content)
	return updateLiveContent(state, content)
}

/** Marks the live frame as painted and retires the frames it replaces. */
export function markFrameReady<P>(
	state: PreviewFrameSwapState<P>,
	id: number,
): PreviewFrameSwapState<P> {
	if (state.liveId !== id || state.readyId === id) return state
	const live = state.frames.find((frame) => frame.id === id)
	if (!live) return state
	return { ...state, readyId: id, frames: state.frames.length > 1 ? [live] : state.frames }
}

export interface RenderedPreviewFrame<P> extends PreviewFrame<P> {
	isLive: boolean
	isVisible: boolean
}

export function usePreviewFrameSwap<P>({
	token,
	content,
	isEditing,
	contentIsEditVariant,
	props,
}: Omit<PreviewFrameSwapInput<P>, "latestProps"> & { props: P }) {
	const latestPropsRef = useRef<P | null>(null)
	const [state, setState] = useState(() => createFrameSwapState<P>(token, content))

	// Adjust during render so the old frame is frozen in the same commit that
	// the new content arrives; an effect would let the old frame rebuild first.
	const next = reconcileFrameSwap(state, {
		token,
		content,
		isEditing,
		contentIsEditVariant,
		latestProps: latestPropsRef.current,
	})
	if (next !== state) setState(next)

	useLayoutEffect(() => {
		latestPropsRef.current = props
	})

	const frames = useMemo<RenderedPreviewFrame<P>[]>(
		() =>
			next.frames.map((frame, index) => ({
				...frame,
				isLive: frame.id === next.liveId,
				isVisible: index === 0,
			})),
		[next],
	)

	const markReady = (id: number) => {
		setState((current) => markFrameReady(current, id))
	}
	// Anything still holding a previous frame covers the gap on its own.
	const holdsPreviousFrame = next.frames.length > 1 || next.liveId === null

	return { frames, markReady, holdsPreviousFrame }
}
