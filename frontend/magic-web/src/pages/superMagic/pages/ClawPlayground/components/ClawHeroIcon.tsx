import { memo, useId, useLayoutEffect, useRef } from "react"
import { cn } from "@/lib/utils"

const ENTRY_ANIMATION_DURATION_MS = 700
const EXIT_ANIMATION_DURATION_MS = 280
const JAW_ANIMATION_DURATION_MS = 840
const JAW_ANIMATION_DELAY_MS = 730
const ENTRY_SOUND_TIMESTAMP_MS = ENTRY_ANIMATION_DURATION_MS * 0.72
const JAW_CLICK_TIMESTAMPS_MS = [
	JAW_ANIMATION_DELAY_MS + JAW_ANIMATION_DURATION_MS * 0.16,
	JAW_ANIMATION_DELAY_MS + JAW_ANIMATION_DURATION_MS * 0.66,
]

interface ClawHeroIconProps {
	className?: string
	testId?: string
	animationDirection?: "enter" | "exit"
	enableSound?: boolean
}

export function ClawHeroIcon({
	className,
	testId,
	animationDirection = "enter",
	enableSound = false,
}: ClawHeroIconProps) {
	const instanceId = useId().replace(/:/g, "")
	const entryAnimationName = `claw-entry-${instanceId}`
	const exitAnimationName = `claw-exit-${instanceId}`
	const upperJawAnimationName = `claw-upper-cycle-${instanceId}`
	const lowerJawAnimationName = `claw-lower-cycle-${instanceId}`
	const entryGroupRef = useRef<SVGGElement>(null)
	const upperJawGroupRef = useRef<SVGGElement>(null)
	const lowerJawGroupRef = useRef<SVGGElement>(null)
	const ids = {
		baseGradient: `claw-base-gradient-${instanceId}`,
		baseFilter: `claw-base-filter-${instanceId}`,
		upperGradient: `claw-upper-gradient-${instanceId}`,
		upperHighlightFilter: `claw-upper-highlight-filter-${instanceId}`,
		lowerGradient: `claw-lower-gradient-${instanceId}`,
		lowerHighlightFilter: `claw-lower-highlight-filter-${instanceId}`,
		glowFilter: `claw-glow-filter-${instanceId}`,
		clipPath: `claw-clip-path-${instanceId}`,
	}
	const entryAnimation = `${entryAnimationName} ${ENTRY_ANIMATION_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`
	const exitAnimation = `${exitAnimationName} ${EXIT_ANIMATION_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`
	const jawAnimationTiming = `${JAW_ANIMATION_DURATION_MS}ms ${JAW_ANIMATION_DELAY_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`
	const upperJawAnimation = `${upperJawAnimationName} ${jawAnimationTiming}`
	const lowerJawAnimation = `${lowerJawAnimationName} ${jawAnimationTiming}`

	useLayoutEffect(() => {
		const isEntering = animationDirection === "enter"

		restartSvgAnimation(entryGroupRef.current, isEntering ? entryAnimation : exitAnimation)

		if (isEntering) {
			restartSvgAnimation(upperJawGroupRef.current, upperJawAnimation)
			restartSvgAnimation(lowerJawGroupRef.current, lowerJawAnimation)
		} else {
			resetSvgAnimation(upperJawGroupRef.current)
			resetSvgAnimation(lowerJawGroupRef.current)
		}

		if (!isEntering || !enableSound) return

		return scheduleClawSoundTimeline([
			{
				delay: ENTRY_SOUND_TIMESTAMP_MS,
				play: playClawEntrySound,
			},
			...JAW_CLICK_TIMESTAMPS_MS.map((delay) => ({
				delay,
				play: playClawJawClickSound,
			})),
		])
	}, [
		animationDirection,
		enableSound,
		entryAnimation,
		exitAnimation,
		lowerJawAnimation,
		upperJawAnimation,
	])

	return (
		<svg
			className={cn(className)}
			data-testid={testId}
			width="100"
			height="100"
			viewBox="0 0 100 100"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<style>
				{`
					@keyframes ${entryAnimationName} {
						0% {
							transform: translate(18px, 16px) rotate(8deg);
						}
						82% {
							transform: translate(-1.6px, -1.2px) rotate(-1.25deg);
						}
						100% {
							transform: translate(0, 0) rotate(0deg);
						}
					}

					@keyframes ${exitAnimationName} {
						0% {
							transform: translate(0, 0) rotate(0deg);
						}
						18% {
							transform: translate(-1.6px, -1.2px) rotate(-1.25deg);
						}
						100% {
							transform: translate(18px, 16px) rotate(8deg);
						}
					}

					@keyframes ${upperJawAnimationName} {
						0%, 50%, 100% {
							transform: rotate(0deg);
						}
						16%, 66% {
							transform: rotate(5.5deg);
						}
					}

					@keyframes ${lowerJawAnimationName} {
						0%, 50%, 100% {
							transform: rotate(0deg);
						}
						16%, 66% {
							transform: rotate(-11deg);
						}
					}
				`}
			</style>
			<g clipPath={`url(#${ids.clipPath})`}>
				<path
					d="M0 50C0 22.3858 22.3858 0 50 0V0C77.6142 0 100 22.3858 100 50V50C100 77.6142 77.6142 100 50 100V100C22.3858 100 0 77.6142 0 50V50Z"
					fill="white"
				/>
				<g
					ref={entryGroupRef}
					style={{
						transformBox: "view-box",
						transformOrigin: "50px 56px",
					}}
				>
					<g>
						<g
							ref={lowerJawGroupRef}
							style={{
								transformBox: "view-box",
								transformOrigin: "47px 55px",
							}}
						>
							<path
								d="M70.4325 94.7691C66.3101 92.7514 61.696 82.6636 61.696 82.6636L76.2577 60.4803C80.3115 62.5216 93.514 66.2185 93.5156 76.5812C93.5166 82.7125 75.4709 97.2353 70.4325 94.7691Z"
								fill={`url(#${ids.lowerGradient})`}
							/>
							<g opacity="0.4" filter={`url(#${ids.baseFilter})`}>
								<path
									d="M84.4221 63.0473C83.8302 66.9005 83.1482 68.8406 80.2791 71.2093C77.4108 73.5772 71.4337 77.3059 69.6256 77.9802L69.0337 76.3069C70.7336 75.673 73.5253 74.2161 76.305 71.9213C79.0836 69.6274 81.822 66.5188 83.4601 62.5918L84.4221 63.0473Z"
									fill="black"
								/>
							</g>
							<path
								d="M43.3789 57.1895C46.9298 56.5377 52.0919 61.0421 54.2292 63.3758C54.3321 67.1149 53.4177 75.5908 48.936 79.5813C29.5654 83.6304 14.9068 53.2728 19.6646 48.5742C24.4224 43.8756 27.4865 47.3068 28.4154 48.6395C29.3443 49.9722 29.7307 53.85 31.7027 53.4095C33.6748 52.969 36.0812 53.795 37.0101 55.1277C37.939 56.4604 38.9403 58.0042 43.3789 57.1895Z"
								fill={`url(#${ids.baseGradient})`}
							/>
							<g
								opacity="0.5"
								filter={`url(#${ids.lowerHighlightFilter})`}
								style={{ mixBlendMode: "hard-light" }}
							>
								<path
									d="M30.2697 56.5469C29.6899 56.2735 28.7543 56.8516 28.1453 56.1928C27.6289 55.5498 27.9616 55.1674 27.4353 54.6269C26.917 54.0608 26.9182 53.2762 26.6101 53.0801C26.3003 52.8747 26.8424 52.6084 26.5621 52.2626C26.2833 51.9101 26.2724 51.6315 26.349 51.2208C26.4165 50.8074 26.3049 49.7012 26.0011 49.3371C25.6857 48.9721 26.0337 48.4221 26.1354 48.1332C26.1667 48.0372 26.2139 47.9677 26.2719 47.9098C26.296 47.8887 26.3367 47.8927 26.3731 47.9051C26.3732 47.9051 26.3732 47.9051 26.3732 47.9051C26.4185 47.9216 26.461 47.9417 26.4631 47.9623C26.4715 48.0739 26.5574 48.273 26.7543 48.4763C27.1277 48.8493 26.7782 48.9489 27.0594 49.4898C27.3506 50.0287 27.7552 50.2597 27.753 50.9648C27.7707 51.6832 28.6484 51.4975 28.5609 52.5234C28.5217 53.5675 29.428 53.2385 29.9476 53.646C30.3132 53.9086 30.4044 54.1644 30.604 54.3022C30.9927 54.3707 31.317 54.4517 31.5579 54.4672C32.2616 54.5065 33.2374 54.6446 34.0714 55.1618C34.892 55.6596 36.055 56.0282 36.7182 56.8495C37.3866 57.6548 38.1576 58.8442 38.4245 59.4415C38.6983 60.0404 38.7554 60.1773 39.2186 60.5814C39.4821 60.8127 39.7197 61.2421 39.7415 61.7095C39.7502 61.942 39.5837 61.999 39.4055 61.8815C39.1455 61.7119 39.0697 61.4721 38.8111 61.4802C38.2916 61.495 38.0964 61.507 38.0623 61.0659C38.0256 60.6246 37.4791 60.8528 37.3936 60.6543C37.3029 60.4594 37.5644 60.2159 36.6292 59.6242C35.6918 59.0541 35.208 58.7722 34.8641 58.5853C34.5277 58.4028 34.0173 57.7084 33.415 57.5274C32.835 57.3199 31.7168 56.8752 31.2394 57.016C30.8649 57.1117 30.8207 56.9005 30.604 56.6993C30.5056 56.6521 30.3968 56.6018 30.2697 56.5469Z"
									fill="white"
								/>
							</g>
						</g>
						<g
							ref={upperJawGroupRef}
							style={{
								transformBox: "view-box",
								transformOrigin: "47px 55px",
							}}
						>
							<path
								d="M56.1739 20.4944C37.6227 15.087 18.955 30.3728 19.0453 34.4682C19.0687 35.529 20.5151 38.2656 23.1173 38.2811C25.7195 38.2967 27.8162 39.6487 28.7608 41.6826C29.7053 43.7165 34.412 43.7829 35.3291 44.018C36.2461 44.2531 36.9556 47.2041 37.7159 48.0505C38.4762 48.897 43.3397 48.352 46.0597 54.2617C52.4718 69.9139 44.5946 68.8718 46.3234 80.5542C52.461 90.9235 77.8207 77.1795 82.8678 65.1166C87.9149 53.0538 79.3628 27.2536 56.1739 20.4944Z"
								fill={`url(#${ids.upperGradient})`}
							/>
							<g
								filter={`url(#${ids.upperHighlightFilter})`}
								style={{ mixBlendMode: "hard-light" }}
							>
								<path
									d="M40.356 41.6077C40.1878 42.2866 43.8156 47.252 46.2623 49.0111C49.3207 51.2099 56.2911 57.9807 51.8998 66.9815"
									stroke="white"
									strokeWidth="1.5625"
								/>
							</g>
							<g filter={`url(#${ids.glowFilter})`}>
								<path
									d="M59.4706 23.8548C60.0258 25.5137 51.7764 24.528 44.1559 25.0636C39.1004 25.4189 22.2543 35.3064 21.6991 33.6475C21.1439 31.9886 32.6308 24.611 36.6121 23.2786C47.4327 19.0791 58.9155 22.1959 59.4706 23.8548Z"
									fill="white"
								/>
							</g>
						</g>
					</g>
				</g>
			</g>
			<path
				d="M50 0.5C77.3381 0.5 99.5 22.6619 99.5 50C99.5 77.3381 77.3381 99.5 50 99.5C22.6619 99.5 0.5 77.3381 0.5 50C0.5 22.6619 22.6619 0.5 50 0.5Z"
				stroke="#E5E5E5"
			/>
			<defs>
				<filter
					id={ids.baseFilter}
					x="62.7837"
					y="56.3418"
					width="27.8882"
					height="27.8884"
					filterUnits="userSpaceOnUse"
					colorInterpolationFilters="sRGB"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend
						mode="normal"
						in="SourceGraphic"
						in2="BackgroundImageFix"
						result="shape"
					/>
					<feGaussianBlur
						stdDeviation="3.125"
						result="effect1_foregroundBlur_15581_146807"
					/>
				</filter>
				<filter
					id={ids.lowerHighlightFilter}
					x="19.6216"
					y="41.6449"
					width="26.3701"
					height="26.5459"
					filterUnits="userSpaceOnUse"
					colorInterpolationFilters="sRGB"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend
						mode="normal"
						in="SourceGraphic"
						in2="BackgroundImageFix"
						result="shape"
					/>
					<feGaussianBlur
						stdDeviation="3.125"
						result="effect1_foregroundBlur_15581_146807"
					/>
				</filter>
				<filter
					id={ids.upperHighlightFilter}
					x="33.3193"
					y="35.1698"
					width="27.0244"
					height="38.4042"
					filterUnits="userSpaceOnUse"
					colorInterpolationFilters="sRGB"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend
						mode="normal"
						in="SourceGraphic"
						in2="BackgroundImageFix"
						result="shape"
					/>
					<feGaussianBlur
						stdDeviation="3.125"
						result="effect1_foregroundBlur_15581_146807"
					/>
				</filter>
				<filter
					id={ids.glowFilter}
					x="12.3047"
					y="11.8025"
					width="56.5674"
					height="31.4075"
					filterUnits="userSpaceOnUse"
					colorInterpolationFilters="sRGB"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend
						mode="normal"
						in="SourceGraphic"
						in2="BackgroundImageFix"
						result="shape"
					/>
					<feGaussianBlur
						stdDeviation="4.6875"
						result="effect1_foregroundBlur_15581_146807"
					/>
				</filter>
				<linearGradient
					id={ids.lowerGradient}
					x1="70.4329"
					y1="80.7781"
					x2="89.8947"
					y2="94.9373"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#EF4444" />
					<stop offset="1" stopColor="#DC2626" />
				</linearGradient>
				<linearGradient
					id={ids.baseGradient}
					x1="34.075"
					y1="57.264"
					x2="55.5425"
					y2="55.7275"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#EF4444" />
					<stop offset="1" stopColor="#991B1B" />
				</linearGradient>
				<linearGradient
					id={ids.upperGradient}
					x1="82.0636"
					y1="52.9162"
					x2="29.8222"
					y2="15.2433"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#EF4444" />
					<stop offset="1" stopColor="#FCA5A5" />
				</linearGradient>
				<clipPath id={ids.clipPath}>
					<path
						d="M0 50C0 22.3858 22.3858 0 50 0V0C77.6142 0 100 22.3858 100 50V50C100 77.6142 77.6142 100 50 100V100C22.3858 100 0 77.6142 0 50V50Z"
						fill="white"
					/>
				</clipPath>
			</defs>
		</svg>
	)
}

function restartSvgAnimation(element: SVGGElement | null, animationValue: string) {
	if (!element) return

	element.style.animation = "none"
	void element.getBoundingClientRect()
	element.style.animation = animationValue
}

function resetSvgAnimation(element: SVGGElement | null) {
	if (!element) return

	element.style.animation = "none"
}

function scheduleClawSoundTimeline(
	events: Array<{
		delay: number
		play: () => void
	}>,
) {
	if (typeof window === "undefined") return () => undefined

	const timeoutIds = events.map(({ delay, play }) =>
		window.setTimeout(() => {
			play()
		}, delay),
	)

	return () => {
		timeoutIds.forEach((timeoutId) => {
			window.clearTimeout(timeoutId)
		})
	}
}

function playClawEntrySound() {
	const audioContext = getPlayableAudioContext()
	if (!audioContext) return

	const now = audioContext.currentTime
	const filter = audioContext.createBiquadFilter()
	filter.type = "bandpass"
	filter.frequency.setValueAtTime(720, now)
	filter.Q.setValueAtTime(0.8, now)

	const swoopOscillator = audioContext.createOscillator()
	const swoopGain = audioContext.createGain()
	swoopOscillator.type = "sine"
	swoopOscillator.frequency.setValueAtTime(280, now)
	swoopOscillator.frequency.exponentialRampToValueAtTime(520, now + 0.07)
	swoopGain.gain.setValueAtTime(0.0001, now)
	swoopGain.gain.exponentialRampToValueAtTime(0.016, now + 0.018)
	swoopGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)

	const settleOscillator = audioContext.createOscillator()
	const settleGain = audioContext.createGain()
	settleOscillator.type = "triangle"
	settleOscillator.frequency.setValueAtTime(640, now + 0.035)
	settleOscillator.frequency.exponentialRampToValueAtTime(360, now + 0.09)
	settleGain.gain.setValueAtTime(0.0001, now)
	settleGain.gain.exponentialRampToValueAtTime(0.008, now + 0.05)
	settleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)

	swoopOscillator.connect(swoopGain)
	settleOscillator.connect(settleGain)
	swoopGain.connect(filter)
	settleGain.connect(filter)
	filter.connect(audioContext.destination)

	swoopOscillator.start(now)
	settleOscillator.start(now + 0.03)
	swoopOscillator.stop(now + 0.16)
	settleOscillator.stop(now + 0.13)
}

function playClawJawClickSound() {
	const audioContext = getPlayableAudioContext()
	if (!audioContext) return

	const now = audioContext.currentTime
	const filter = audioContext.createBiquadFilter()
	filter.type = "highpass"
	filter.frequency.setValueAtTime(320, now)

	const bodyOscillator = audioContext.createOscillator()
	const bodyGain = audioContext.createGain()
	bodyOscillator.type = "triangle"
	bodyOscillator.frequency.setValueAtTime(900, now)
	bodyOscillator.frequency.exponentialRampToValueAtTime(420, now + 0.04)
	bodyGain.gain.setValueAtTime(0.0001, now)
	bodyGain.gain.exponentialRampToValueAtTime(0.024, now + 0.003)
	bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055)

	const accentOscillator = audioContext.createOscillator()
	const accentGain = audioContext.createGain()
	accentOscillator.type = "square"
	accentOscillator.frequency.setValueAtTime(1800, now)
	accentOscillator.frequency.exponentialRampToValueAtTime(820, now + 0.022)
	accentGain.gain.setValueAtTime(0.0001, now)
	accentGain.gain.exponentialRampToValueAtTime(0.011, now + 0.002)
	accentGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03)

	bodyOscillator.connect(bodyGain)
	accentOscillator.connect(accentGain)
	bodyGain.connect(filter)
	accentGain.connect(filter)
	filter.connect(audioContext.destination)

	bodyOscillator.start(now)
	accentOscillator.start(now)
	bodyOscillator.stop(now + 0.07)
	accentOscillator.stop(now + 0.04)
}

function getPlayableAudioContext() {
	if (typeof window === "undefined") return
	if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return

	const AudioContextConstructor = getAudioContextConstructor()
	if (!AudioContextConstructor) return

	const audioContext = getSharedAudioContext(AudioContextConstructor)
	if (!audioContext) return

	if (audioContext.state === "suspended") void audioContext.resume().catch(() => undefined)

	return audioContext
}

function getAudioContextConstructor() {
	if (typeof window === "undefined") return null

	return (
		window.AudioContext ||
		(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
		null
	)
}

let sharedAudioContext: AudioContext | null = null

function getSharedAudioContext(AudioContextConstructor: typeof AudioContext) {
	if (sharedAudioContext) return sharedAudioContext

	try {
		sharedAudioContext = new AudioContextConstructor()
		return sharedAudioContext
	} catch {
		return null
	}
}

export default memo(ClawHeroIcon)
