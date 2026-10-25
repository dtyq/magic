import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom"
import type { Placement } from "@floating-ui/dom"
import { ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import { findResearchOnboardingAnchor } from "./onboardingState"

export interface ResearchSpotlightStep {
	anchor: string
	title: string
	text: string
	placement?: Placement
}

export type ResearchSpotlightOutcome = "finished" | "skipped" | "empty"

interface ResearchSpotlightProps {
	steps: ResearchSpotlightStep[]
	/** Primary label of the last step, e.g. "开始研究". */
	finishLabel: string
	onClose: (outcome: ResearchSpotlightOutcome) => void
}

interface Box {
	left: number
	top: number
	width: number
	height: number
}

/**
 * Step-by-step highlight over the research pages. The ring, card and footer mirror the app's
 * benefits tour so the two read as one product; positioning comes from floating-ui instead of the
 * benefits tour's own engine, which cannot run outside its reward flow.
 *
 * Steps whose anchor is not rendered (a breakpoint hides it, the conversation panel is collapsed,
 * a study has no respondents yet) are dropped once when the tour opens, so the counter never
 * promises a step it cannot show.
 */
export default function ResearchSpotlight({ steps, finishLabel, onClose }: ResearchSpotlightProps) {
	const { t } = useTranslation("personaResearch")
	const [available] = useState(() =>
		steps.filter((step) => findResearchOnboardingAnchor(step.anchor)),
	)
	const [index, setIndex] = useState(0)
	const [ring, setRing] = useState<Box | null>(null)
	// Keyed by anchor so a new step never shows its card at the previous step's spot.
	const [placed, setPlaced] = useState<{ anchor: string; left: number; top: number } | null>(null)
	const cardRef = useRef<HTMLElement>(null)
	const primaryRef = useRef<HTMLButtonElement>(null)
	const rootRef = useRef<HTMLDivElement>(null)
	// Where focus goes back to when the tour closes, however it closes (finished, skipped, or
	// unmounted by the page). Updated below when focus is handed back late by a closing dialog.
	const restoreFocusRef = useRef<Element | null>(
		typeof document === "undefined" ? null : document.activeElement,
	)
	const step = available[index]
	const isLast = index === available.length - 1

	useEffect(() => {
		if (available.length === 0) onClose("empty")
		// Decided once on open; onClose is a stable callback from the controller.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Follow the anchor while the step is up: scrolling, resizing and layout shifts (a study
	// streaming in) all move it. autoUpdate listens to those events instead of polling every
	// frame, and unchanged measurements skip the re-render, so a busy page stays responsive.
	useLayoutEffect(() => {
		const card = cardRef.current
		const anchor = step ? findResearchOnboardingAnchor(step.anchor) : null
		if (!step || !card || !anchor) return
		anchor.scrollIntoView({ block: "nearest", inline: "nearest" })
		let cancelled = false
		const update = () => {
			const rect = anchor.getBoundingClientRect()
			setRing((current) =>
				current &&
				current.left === rect.left &&
				current.top === rect.top &&
				current.width === rect.width &&
				current.height === rect.height
					? current
					: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
			)
			void computePosition(anchor, card, {
				strategy: "fixed",
				placement: step.placement ?? "bottom",
				// 14px clears the ring's 4px padding plus its 2px border with room to breathe.
				// crossAxis shift keeps the card on screen when the anchor is taller than the
				// window and neither side has room; it may then overlap the anchor's edge.
				middleware: [
					offset(14),
					flip({ padding: 12 }),
					shift({ padding: 12, crossAxis: true }),
				],
			}).then(({ x, y }) => {
				if (cancelled) return
				setPlaced((current) =>
					current?.anchor === step.anchor && current.left === x && current.top === y
						? current
						: { anchor: step.anchor, left: x, top: y },
				)
			})
		}
		const stop = autoUpdate(anchor, card, update)
		return () => {
			cancelled = true
			stop()
		}
	}, [step])

	// The card stays `invisible` until it is placed, and an invisible button cannot take focus, so
	// focus moves in once the current step's card is shown rather than when the index changes.
	const isPlaced = Boolean(step && placed?.anchor === step.anchor)
	useEffect(() => {
		if (isPlaced) primaryRef.current?.focus({ preventScroll: true })
	}, [index, isPlaced])

	// Keep keyboard focus inside the tour (it is a modal dialog). This also catches focus handed
	// back late by a closing dialog — replaying from the help dialog restores focus to its trigger
	// after the tour has already opened.
	useEffect(() => {
		const handleFocusIn = (event: FocusEvent) => {
			const root = rootRef.current
			if (!root || root.contains(event.target as Node)) return
			// That element is where focus meant to be; return it there once the tour is over.
			restoreFocusRef.current = event.target as Element
			primaryRef.current?.focus({ preventScroll: true })
		}
		document.addEventListener("focusin", handleFocusIn)
		return () => {
			document.removeEventListener("focusin", handleFocusIn)
			const target = restoreFocusRef.current
			if (target instanceof HTMLElement && target.isConnected && target !== document.body)
				target.focus({ preventScroll: true })
		}
	}, [])

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation()
				onClose("skipped")
				return
			}
			if (event.key !== "Tab") return
			// The card is the last thing in the document, so Tab would leave the page; cycle
			// through the card's own buttons instead, as a modal dialog does.
			const buttons = Array.from(cardRef.current?.querySelectorAll("button") ?? [])
			if (buttons.length === 0) return
			event.preventDefault()
			const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
			const direction = event.shiftKey ? -1 : 1
			buttons[(current + direction + buttons.length) % buttons.length].focus()
		}
		window.addEventListener("keydown", handleKeyDown, true)
		return () => window.removeEventListener("keydown", handleKeyDown, true)
	}, [onClose])

	if (!step) return null
	const cardPosition = isPlaced && placed ? { left: placed.left, top: placed.top } : null

	return createPortal(
		// Full-screen layer: the page underneath is not clickable while the tour is up, so a
		// stray click cannot start a study or navigate away mid-explanation.
		<div
			ref={rootRef}
			className="fixed inset-0 z-[1200] text-foreground"
			role="dialog"
			aria-modal="true"
			aria-label={t("onboarding.stepLabel", { current: index + 1, total: available.length })}
			data-testid="research-onboarding"
		>
			{ring ? (
				// The ring's huge spread shadow is the dimmed backdrop; the hole is the anchor.
				<div
					className="pointer-events-none fixed z-[1201] rounded-xl border-2 border-white/95 shadow-[0_0_0_4px_rgba(255,255,255,0.16),0_0_0_9999px_rgba(52,52,52,0.62),0_12px_32px_rgba(17,19,24,0.18)] transition-[left,top,width,height] duration-300 ease-out motion-reduce:transition-none"
					style={{
						left: ring.left - 4,
						top: ring.top - 4,
						width: ring.width + 8,
						height: ring.height + 8,
					}}
				/>
			) : null}
			<section
				ref={cardRef}
				className={cn(
					"fixed z-[1202] w-[min(380px,calc(100vw-32px))] rounded-[14px] border border-border bg-background px-5 pb-4 pt-[18px] shadow-[0_18px_48px_rgba(17,24,39,0.24)] transition-opacity duration-200 motion-reduce:transition-none",
					// Hidden until floating-ui has placed it for this step, so it never flashes at
					// the previous step's spot; the opacity fade is the step-change feedback.
					cardPosition ? "opacity-100" : "invisible opacity-0",
				)}
				style={cardPosition ?? { left: 0, top: 0 }}
			>
				<div className="mb-3 flex items-center gap-3 text-[10px] font-semibold text-muted-foreground">
					<span className="flex items-center gap-1" aria-hidden>
						{available.map((item, itemIndex) => (
							<i
								key={item.anchor}
								className={cn(
									"block h-1.5 rounded-full bg-[#d4d4d4] transition-[width] duration-300 motion-reduce:transition-none dark:bg-muted",
									itemIndex === index
										? "w-4 bg-foreground dark:bg-foreground"
										: "w-1.5",
								)}
							/>
						))}
					</span>
					{t("onboarding.stepLabel", { current: index + 1, total: available.length })}
				</div>
				<h3 className="text-base font-semibold leading-snug">{step.title}</h3>
				<p className="mt-2 text-xs leading-[1.7] text-muted-foreground">{step.text}</p>
				<div className="mt-4 flex items-center gap-1 border-t border-border pt-3.5">
					{index > 0 ? (
						<button
							type="button"
							className="min-h-9 whitespace-nowrap rounded-[10px] px-3 text-[13px] text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
							onClick={() => setIndex(index - 1)}
						>
							{t("onboarding.previous")}
						</button>
					) : null}
					<button
						type="button"
						className="min-h-9 whitespace-nowrap rounded-[10px] px-3 text-[13px] text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() => onClose("skipped")}
					>
						{t("onboarding.skip")}
					</button>
					<button
						ref={primaryRef}
						type="button"
						data-testid="research-onboarding-primary"
						className="ml-auto inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-foreground px-4 text-[13px] text-background outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						onClick={() => (isLast ? onClose("finished") : setIndex(index + 1))}
					>
						{isLast ? finishLabel : t("onboarding.next")}
						{isLast ? null : <ArrowRight className="size-3.5" aria-hidden />}
					</button>
				</div>
			</section>
		</div>,
		document.body,
	)
}
