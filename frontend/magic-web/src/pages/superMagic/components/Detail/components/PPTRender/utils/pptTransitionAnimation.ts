import type { PPTTransition } from "./pptTransitions"

/** Only these fixed keyframes reach WAAPI; document data never supplies CSS expressions. */
export function getPPTTransitionKeyframes(transition: PPTTransition, backward = false) {
	let direction = transition.direction ?? "left"
	if (backward) {
		const opposite = { left: "right", right: "left", up: "down", down: "up" } as const
		direction = opposite[direction]
	}
	const vertical = direction === "up" || direction === "down"
	const sign = direction === "left" || direction === "up" ? -1 : 1
	const translate = (amount: number) => `translate${vertical ? "Y" : "X"}(${amount}%)`
	const stationary: Keyframe[] = [{ opacity: 1 }, { opacity: 1 }]
	switch (transition.effect) {
		case "fade":
			return {
				outgoing: [{ opacity: 1 }, { opacity: 0 }],
				incoming: [{ opacity: 0 }, { opacity: 1 }],
			}
		case "push":
		case "cover":
			return {
				outgoing:
					transition.effect === "push"
						? [{ transform: translate(0) }, { transform: translate(sign * 100) }]
						: stationary,
				incoming: [{ transform: translate(-sign * 100) }, { transform: translate(0) }],
			}
		case "wipe": {
			const clips = {
				left: "inset(0 0 0 100%)",
				right: "inset(0 100% 0 0)",
				up: "inset(100% 0 0 0)",
				down: "inset(0 0 100% 0)",
			}
			return {
				outgoing: stationary,
				incoming: [{ clipPath: clips[direction] }, { clipPath: "inset(0 0 0 0)" }],
			}
		}
		case "zoom":
			return {
				outgoing: stationary,
				incoming: [
					{ transform: "scale(0.96)", opacity: 0 },
					{ transform: "scale(1)", opacity: 1 },
				],
			}
		default:
			return null
	}
}

export function animatePPTTransition(
	outgoing: HTMLElement,
	incoming: HTMLElement,
	transition: PPTTransition,
	backward = false,
): { finished: Promise<void>; cancel: () => void } {
	const frames = getPPTTransitionKeyframes(transition, backward)
	const animations: Animation[] = []
	const cancel = () => animations.forEach((animation) => animation.cancel())
	if (frames && outgoing.animate && incoming.animate) {
		const options: KeyframeAnimationOptions = {
			duration: Math.min(2000, Math.max(100, transition.duration_ms ?? 400)),
			easing: transition.easing === "linear" ? "linear" : "ease-in-out",
			fill: "both",
		}
		try {
			animations.push(outgoing.animate(frames.outgoing, options))
			animations.push(incoming.animate(frames.incoming, options))
		} catch {
			// Older webviews may expose animate without supporting every frame property.
			cancel()
		}
	}
	return {
		finished: Promise.all(
			animations.map((animation) => animation.finished.catch(() => undefined)),
		).then(() => undefined),
		cancel,
	}
}
