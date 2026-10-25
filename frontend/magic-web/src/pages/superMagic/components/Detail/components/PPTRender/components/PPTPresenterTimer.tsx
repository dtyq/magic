import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { RotateCcw } from "lucide-react"

const digitSegments: Record<string, string> = {
	"0": "abcdef",
	"1": "bc",
	"2": "abdeg",
	"3": "abcdg",
	"4": "bcfg",
	"5": "acdfg",
	"6": "acdefg",
	"7": "abc",
	"8": "abcdefg",
	"9": "abcdfg",
}
const segments = [
	["a", "4,1 16,1 18,3 16,5 4,5 2,3"],
	["b", "17,4 19,6 19,16 17,18 15,16 15,6"],
	["c", "17,20 19,22 19,32 17,34 15,32 15,22"],
	["d", "4,33 16,33 18,35 16,37 4,37 2,35"],
	["e", "3,20 5,22 5,32 3,34 1,32 1,22"],
	["f", "3,4 5,6 5,16 3,18 1,16 1,6"],
	["g", "4,17 16,17 18,19 16,21 4,21 2,19"],
] as const

export default function PPTPresenterTimer() {
	const { t } = useTranslation("super")
	const [elapsed, setElapsed] = useState(0)
	const startedAt = useRef(Date.now())
	useEffect(() => {
		// Wall-clock deltas stay accurate when the presenter window is in the background.
		const timer = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 1000)
		return () => window.clearInterval(timer)
	}, [])
	const seconds = Math.floor(elapsed / 1000)
	const display = `${Math.floor(seconds / 60)
		.toString()
		.padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`
	return (
		<div className="mr-auto flex items-center gap-3 px-2">
			<span
				aria-label={t("ppt.presenter.elapsedTime")}
				className="flex items-center gap-0.5 text-white/80"
			>
				<span className="sr-only">{display}</span>
				{/* Local seven-segment glyphs stay crisp and work in the popup without loading a font. */}
				{Array.from(display, (digit, index) =>
					digit === ":" ? (
						<svg
							key={index}
							aria-hidden="true"
							focusable="false"
							viewBox="0 0 8 38"
							className="h-6 w-1.5 fill-current"
						>
							<circle cx="4" cy="12" r="2" />
							<circle cx="4" cy="26" r="2" />
						</svg>
					) : (
						<svg
							key={index}
							aria-hidden="true"
							focusable="false"
							viewBox="0 0 20 38"
							className="h-6 w-3 fill-current"
						>
							{segments.map(([name, points]) => (
								<polygon
									key={name}
									points={points}
									opacity={digitSegments[digit].includes(name) ? 1 : 0.06}
								/>
							))}
						</svg>
					),
				)}
			</span>
			<button
				type="button"
				aria-label={t("ppt.presenter.resetTimer")}
				className="rounded p-1 text-white/70 hover:bg-white/15 focus-visible:outline focus-visible:outline-white"
				onClick={() => {
					startedAt.current = Date.now()
					setElapsed(0)
				}}
			>
				<RotateCcw size={16} />
			</button>
		</div>
	)
}
