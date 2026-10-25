import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { cn } from "@/utils/cn"
import type { EditorPromptCarouselConfig } from "../types"

const DEFAULT_TYPING_INTERVAL_MS = 45
const DEFAULT_HOLD_DURATION_MS = 3000
const DEFAULT_FADE_DURATION_MS = 180

type PromptPhase = "idle" | "typing" | "ready" | "fading"

export interface EditorPromptCarouselHandle {
	getAcceptablePrompt: () => string | null
	showPreviousPrompt: () => boolean
	showNextPrompt: () => boolean
}

interface EditorPromptCarouselProps {
	config: EditorPromptCarouselConfig
	enabled: boolean
	visible?: boolean
	isFocused?: boolean
	onAccept: () => boolean
}

function getPageVisibility() {
	return typeof document === "undefined" || document.visibilityState !== "hidden"
}

function getRandomPromptIndex(length: number) {
	if (length <= 1) return 0
	return Math.floor(Math.random() * length)
}

const EditorPromptCarousel = forwardRef<EditorPromptCarouselHandle, EditorPromptCarouselProps>(
	function EditorPromptCarousel(
		{ config, enabled, visible = true, isFocused = false, onAccept },
		ref,
	) {
		const reduceMotion = Boolean(useReducedMotion())
		const [pageVisible, setPageVisible] = useState(getPageVisibility)
		const [displayText, setDisplayText] = useState("")
		const [phase, setPhase] = useState<PromptPhase>("idle")
		const [restartVersion, setRestartVersion] = useState(0)
		const timeoutRef = useRef<number | null>(null)
		const generationRef = useRef(0)
		const currentIndexRef = useRef<number | null>(null)
		const currentPromptRef = useRef("")
		const visibleLengthRef = useRef(0)
		const phaseRef = useRef<PromptPhase>("idle")
		const readyRef = useRef(false)
		const wasEnabledRef = useRef(false)
		const advanceOnNextEnableRef = useRef(false)

		const typingIntervalMs = config.typingIntervalMs ?? DEFAULT_TYPING_INTERVAL_MS
		const holdDurationMs = config.holdDurationMs ?? DEFAULT_HOLD_DURATION_MS
		const fadeDurationMs = config.fadeDurationMs ?? DEFAULT_FADE_DURATION_MS
		const clickable = config.clickable ?? true

		useImperativeHandle(ref, () => {
			const restartPrompt = (offset: number) => {
				const examples = config.examples.filter(Boolean)
				if (!enabled || examples.length === 0) return false

				const currentIndex =
					currentIndexRef.current ?? getRandomPromptIndex(examples.length)
				currentIndexRef.current =
					(currentIndex + offset + examples.length) % examples.length
				readyRef.current = false
				currentPromptRef.current = ""
				visibleLengthRef.current = 0
				phaseRef.current = "idle"
				setDisplayText("")
				setPhase("idle")
				setRestartVersion((version) => version + 1)
				return true
			}

			return {
				getAcceptablePrompt: () =>
					readyRef.current && enabled ? currentPromptRef.current : null,
				showPreviousPrompt: () => restartPrompt(-1),
				showNextPrompt: () => restartPrompt(1),
			}
		}, [config.examples, enabled])

		useEffect(() => {
			const handleVisibilityChange = () => setPageVisible(getPageVisibility())
			document.addEventListener("visibilitychange", handleVisibilityChange)
			return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
		}, [])

		useEffect(() => {
			const examples = config.examples.filter(Boolean)
			const generation = ++generationRef.current
			const advancePromptIndex = () => {
				currentIndexRef.current = ((currentIndexRef.current ?? 0) + 1) % examples.length
			}

			const clearTimer = () => {
				if (timeoutRef.current !== null) {
					window.clearTimeout(timeoutRef.current)
					timeoutRef.current = null
				}
			}

			const updatePhase = (nextPhase: PromptPhase) => {
				phaseRef.current = nextPhase
				setPhase(nextPhase)
			}

			const schedule = (callback: () => void, delay: number) => {
				clearTimer()
				timeoutRef.current = window.setTimeout(() => {
					if (generationRef.current !== generation) return
					callback()
				}, delay)
			}

			if (!enabled || examples.length === 0) {
				if (wasEnabledRef.current) advanceOnNextEnableRef.current = true
				wasEnabledRef.current = false
				readyRef.current = false
				currentPromptRef.current = ""
				visibleLengthRef.current = 0
				updatePhase("idle")
				setDisplayText("")
				return clearTimer
			}

			if (!pageVisible) return clearTimer

			if (currentIndexRef.current === null) {
				currentIndexRef.current = getRandomPromptIndex(examples.length)
			}

			if (!wasEnabledRef.current) {
				if (advanceOnNextEnableRef.current) {
					advancePromptIndex()
					advanceOnNextEnableRef.current = false
				}
				wasEnabledRef.current = true
			}

			const startPrompt = () => {
				const currentIndex = currentIndexRef.current ?? 0
				const prompt = examples[currentIndex % examples.length]
				currentPromptRef.current = prompt
				readyRef.current = false

				if (reduceMotion) {
					visibleLengthRef.current = prompt.length
					setDisplayText(prompt)
					updatePhase("ready")
					readyRef.current = true
					schedule(showNextPrompt, holdDurationMs)
					return
				}

				visibleLengthRef.current = 0
				setDisplayText("")
				updatePhase("typing")
				schedule(showNextCharacter, typingIntervalMs)
			}

			const showNextCharacter = () => {
				const prompt = currentPromptRef.current
				const nextLength = Math.min(visibleLengthRef.current + 1, prompt.length)
				visibleLengthRef.current = nextLength
				setDisplayText(prompt.slice(0, nextLength))

				if (nextLength < prompt.length) {
					schedule(showNextCharacter, typingIntervalMs)
					return
				}

				updatePhase("ready")
				readyRef.current = true
				schedule(showNextPrompt, holdDurationMs)
			}

			function showNextPrompt() {
				readyRef.current = false
				if (reduceMotion) {
					advancePromptIndex()
					startPrompt()
					return
				}

				updatePhase("fading")
				schedule(() => {
					advancePromptIndex()
					startPrompt()
				}, fadeDurationMs)
			}

			if (phaseRef.current === "typing" && currentPromptRef.current) {
				schedule(showNextCharacter, typingIntervalMs)
			} else if (phaseRef.current === "ready" && currentPromptRef.current) {
				readyRef.current = true
				schedule(showNextPrompt, holdDurationMs)
			} else if (phaseRef.current === "fading" && currentPromptRef.current) {
				schedule(() => {
					advancePromptIndex()
					startPrompt()
				}, fadeDurationMs)
			} else {
				startPrompt()
			}

			return () => {
				generationRef.current += 1
				clearTimer()
			}
		}, [
			config.examples,
			enabled,
			fadeDurationMs,
			holdDurationMs,
			pageVisible,
			reduceMotion,
			restartVersion,
			typingIntervalMs,
		])

		const showTab = phase === "ready"
		const showNavigationHint =
			enabled &&
			isFocused &&
			Boolean(config.navigationLabel) &&
			config.examples.filter(Boolean).length > 1
		if (!visible) return null

		return (
			<div
				className="pointer-events-none absolute inset-x-0 top-0 z-[1] text-sm leading-5 text-muted-foreground"
				data-testid="editor-prompt-carousel"
			>
				<span
					className={cn(
						"transition-opacity",
						phase === "fading" ? "opacity-0" : "opacity-100",
					)}
					style={{ transitionDuration: `${fadeDurationMs}ms` }}
				>
					<span aria-hidden>{displayText}</span>
					<span
						aria-hidden={!showTab}
						className={cn(
							// Keep Tab and its action label together after the example. The inline group
							// naturally moves to the next line when the remaining width is insufficient.
							"pointer-events-none ml-2 inline-flex max-w-full -translate-y-px items-center gap-1 whitespace-nowrap align-middle",
							"text-[10px] leading-none transition-opacity duration-200",
							showTab ? "opacity-100" : "opacity-0",
						)}
					>
						<button
							type="button"
							tabIndex={-1}
							aria-label={config.applyAriaLabel}
							className={cn(
								"inline-flex h-5 items-center rounded border border-border/80 bg-background/95 px-1.5",
								"font-medium text-muted-foreground shadow-sm",
								showTab && clickable
									? "pointer-events-auto cursor-pointer hover:bg-accent"
									: "pointer-events-none",
							)}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => {
								if (showTab && clickable) onAccept()
							}}
						>
							{config.tabLabel ?? "Tab"}
						</button>
						{config.acceptLabel && (
							<span className="text-muted-foreground/70">{config.acceptLabel}</span>
						)}
					</span>
				</span>
				<span
					aria-hidden={!showNavigationHint}
					className={cn(
						"pointer-events-none mt-1 flex items-center gap-1 text-[10px] leading-none text-muted-foreground/70 transition-opacity duration-200",
						showNavigationHint ? "opacity-100" : "opacity-0",
					)}
				>
					<kbd className="inline-flex h-5 items-center rounded border border-border/70 bg-background/80 px-1.5 font-medium shadow-sm">
						↑↓
					</kbd>
					<span>{config.navigationLabel}</span>
				</span>
			</div>
		)
	},
)

export default EditorPromptCarousel
