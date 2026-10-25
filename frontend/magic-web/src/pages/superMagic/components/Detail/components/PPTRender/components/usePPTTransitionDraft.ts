import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { cloneDeep } from "lodash-es"
import {
	createPPTTransition,
	parsePPTTransition,
	type PPTTransition,
	type PPTTransitionEdit,
	type PPTTransitionEffect,
} from "../utils/pptTransitions"
import {
	getDraftTransitions,
	getRawTransition,
	type TransitionScope,
	type TransitionSlide,
} from "./pptTransitionDraft"
import type { PPTTransitionPreviewSource } from "./PPTTransitionPreview"

export interface PPTTransitionPanelProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	deckKey: string
	slides: TransitionSlide[]
	activePath: string
	selectedPaths: string[]
	config: unknown
	busy: boolean
	previewSource?: PPTTransitionPreviewSource
	initialScope?: "current" | "selected"
	onSave: (edit: PPTTransitionEdit) => Promise<boolean>
	registerBeforeClose?: (guard: (() => Promise<boolean>) | null) => void
}

export function usePPTTransitionDraft(props: PPTTransitionPanelProps) {
	const { open, deckKey, activePath, onOpenChange, busy, registerBeforeClose } = props
	const [session, setSession] = useState(() => capture(props))
	const [scope, setScope] = useState<TransitionScope>(props.initialScope ?? "current")
	const [replacement, setReplacement] = useState<PPTTransition>()
	const [patch, setPatch] = useState<Partial<PPTTransition>>({})
	const [inherit, setInherit] = useState(false)
	const [confirmClose, setConfirmClose] = useState(false)
	const [saving, setSaving] = useState(false)
	const [failed, setFailed] = useState(false)
	const savingRef = useRef(false)
	const generationRef = useRef(0)
	const latestProps = useRef(props)
	latestProps.current = props
	const wasOpen = useRef(false)
	const pendingGuard = useRef<((allowed: boolean) => void) | null>(null)
	const dirty = Boolean(replacement || inherit || Object.keys(patch).length || scope === "all")
	const paths =
		scope === "current"
			? [session.activePath]
			: scope === "selected"
				? session.selectedPaths
				: session.slides.map((slide) => slide.path)
	const transitions = getDraftTransitions(
		session.config,
		paths,
		scope,
		replacement,
		patch,
		inherit,
	)
	const identityChanged = deckKey !== session.deckKey
	const reset = useMemoizedFn(() => {
		generationRef.current += 1
		setSession(capture(props))
		setScope(
			props.initialScope === "selected" && props.selectedPaths.length
				? "selected"
				: "current",
		)
		setReplacement(undefined)
		setPatch({})
		setInherit(false)
		setFailed(false)
		setConfirmClose(false)
	})
	useEffect(() => {
		if (open && !wasOpen.current) reset()
		wasOpen.current = open
		if (!open) {
			generationRef.current += 1
			pendingGuard.current?.(false)
			pendingGuard.current = null
		}
	}, [open, reset])
	useEffect(() => {
		if (!open || (deckKey === session.deckKey && activePath === session.activePath)) return
		// External navigation cannot retarget an existing draft. The normal navigation path
		// awaits the registered guard; this fallback also protects external deck updates.
		if (dirty) setConfirmClose(true)
		else reset()
	}, [open, deckKey, activePath, session.deckKey, session.activePath, dirty, reset])
	const finishClose = useMemoizedFn((allowed: boolean) => {
		setConfirmClose(false)
		pendingGuard.current?.(allowed)
		pendingGuard.current = null
		if (allowed) onOpenChange(false)
	})
	const requestClose = useMemoizedFn(async () => {
		if (savingRef.current || busy) return false
		if (!dirty) {
			onOpenChange(false)
			return true
		}
		pendingGuard.current?.(false)
		setConfirmClose(true)
		return new Promise<boolean>((resolve) => {
			pendingGuard.current = resolve
		})
	})
	useEffect(() => {
		registerBeforeClose?.(open ? requestClose : null)
		return () => {
			registerBeforeClose?.(null)
		}
	}, [open, registerBeforeClose, requestClose])
	useEffect(
		() => () => {
			pendingGuard.current?.(false)
		},
		[],
	)
	const save = useMemoizedFn(async () => {
		if (savingRef.current || busy || identityChanged || !paths.length) return false
		const rawDefault = getRawTransition(session.config)
		if (
			scope === "all" &&
			!replacement &&
			rawDefault !== undefined &&
			!parsePPTTransition(rawDefault)
		) {
			setFailed(true)
			return false
		}
		savingRef.current = true
		setSaving(true)
		setFailed(false)
		const generation = generationRef.current
		try {
			const edit: PPTTransitionEdit = {
				scope: scope === "all" ? "all" : "slides",
				paths,
				expectedTransitions: session.config,
				expectedPaths: session.slides.map((slide) => slide.path),
				...(inherit
					? { inherit: true }
					: replacement || scope === "all"
						? { transition: transitions[0] }
						: { patch }),
			}
			const saved = await props.onSave(edit)
			// A response belonging to a previous deck must not close its replacement panel.
			if (
				generationRef.current !== generation ||
				latestProps.current.deckKey !== session.deckKey ||
				!latestProps.current.open
			)
				return false
			if (saved) finishClose(true)
			else setFailed(true)
			return saved
		} catch {
			if (
				generationRef.current === generation &&
				latestProps.current.deckKey === session.deckKey
			)
				setFailed(true)
			return false
		} finally {
			savingRef.current = false
			setSaving(false)
		}
	})
	const selectEffect = (effect: PPTTransitionEffect) => {
		setReplacement(createPPTTransition(effect))
		setPatch({})
		setInherit(false)
	}
	const changeParameter = (change: Partial<PPTTransition>) => {
		setInherit(false)
		if (inherit) setReplacement({ ...transitions[0], ...change })
		else if (replacement) setReplacement({ ...replacement, ...change })
		else setPatch((previous) => ({ ...previous, ...change }))
	}
	const changeScope = (value: TransitionScope) => {
		setScope(value)
		if (value === "all" && inherit) {
			setInherit(false)
			setReplacement(
				parsePPTTransition(getRawTransition(session.config)) ?? { effect: "none" },
			)
		}
	}
	const restoreDefault = () => {
		setReplacement(undefined)
		setPatch({})
		setInherit(true)
	}
	return {
		session,
		scope,
		setScope: changeScope,
		paths,
		transitions,
		inherit,
		replacesTransition: Boolean(replacement),
		dirty,
		confirmClose,
		saving,
		failed,
		identityChanged,
		requestClose,
		finishClose,
		save,
		selectEffect,
		changeParameter,
		restoreDefault,
	}
}

function capture(props: PPTTransitionPanelProps) {
	const validPaths = new Set(props.slides.map((slide) => slide.path))
	return {
		deckKey: props.deckKey,
		activePath: props.activePath,
		slides: props.slides.map((slide) => ({ ...slide })),
		selectedPaths: [...new Set(props.selectedPaths.filter((path) => validPaths.has(path)))],
		// Only transition metadata is cloned, never the potentially huge attachment tree.
		config: cloneDeep(props.config),
	}
}
