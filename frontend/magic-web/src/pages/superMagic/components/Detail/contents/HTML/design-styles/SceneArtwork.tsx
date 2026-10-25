import { useId } from "react"
import type { StyleScene } from "./styleProfiles"

/** SVG is scene content, not a separately maintained cover. It inherits the style palette. */
export default function SceneArtwork({
	scene,
	label,
	variant = 0,
}: {
	scene: StyleScene
	label: string
	variant?: number
}) {
	const id = useId().replace(/:/g, "")
	return (
		<svg
			viewBox="0 0 640 480"
			role="img"
			aria-label={label}
			className="h-full w-full"
			preserveAspectRatio="xMidYMid slice"
		>
			<defs>
				<linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
					<stop stopColor="var(--scene-primary)" stopOpacity=".75" />
					<stop offset="1" stopColor="var(--scene-bg)" />
				</linearGradient>
			</defs>
			<rect width="640" height="480" fill="var(--scene-surface)" />
			{scene === "commerce" ? (
				<g>
					<ellipse
						cx="320"
						cy="402"
						rx="154"
						ry="22"
						fill="var(--scene-ink)"
						opacity=".08"
					/>
					{variant % 2 === 0 ? (
						<>
							<path
								d="M225 180 Q225 82 320 82 Q415 82 415 180"
								fill="none"
								stroke="var(--scene-primary)"
								strokeWidth="38"
							/>
							<rect
								x="185"
								y="176"
								width="270"
								height="212"
								rx="32"
								fill={`url(#${id})`}
							/>
							<path
								d="M215 214H425M215 232H425"
								stroke="var(--scene-ink)"
								opacity=".12"
							/>
							<circle cx="320" cy="285" r="32" fill="var(--scene-bg)" opacity=".9" />
						</>
					) : (
						<>
							<path
								d="M248 102H392L418 360Q418 396 382 396H258Q222 396 222 360Z"
								fill={`url(#${id})`}
							/>
							<ellipse
								cx="320"
								cy="105"
								rx="72"
								ry="22"
								fill="var(--scene-primary)"
							/>
							<rect
								x="280"
								y="198"
								width="80"
								height="105"
								rx="3"
								fill="var(--scene-bg)"
								opacity=".85"
							/>
							<path
								d="M292 232H348M292 244H335"
								stroke="var(--scene-ink)"
								strokeWidth="3"
							/>
						</>
					)}
				</g>
			) : scene === "editorial" || scene === "portfolio" ? (
				<g>
					<rect x="45" y="40" width="550" height="400" fill={`url(#${id})`} />
					<circle
						cx={variant % 2 === 0 ? 440 : 180}
						cy="145"
						r="68"
						fill="var(--scene-bg)"
					/>
					<path
						d="M45 380L230 165L375 375L495 245L595 370V440H45Z"
						fill="var(--scene-primary)"
					/>
					<path d="M45 435L285 285L520 440" fill="var(--scene-ink)" opacity=".3" />
					<path
						d="M82 74H198M82 88H152"
						stroke="var(--scene-ink)"
						opacity=".35"
						strokeWidth="3"
					/>
				</g>
			) : scene === "terminal" ? (
				<g stroke="var(--scene-primary)" fill="none">
					{[0, 1, 2, 3, 4].map((index) => (
						<ellipse
							key={index}
							cx="320"
							cy="240"
							rx={65 + index * 38}
							ry={55 + index * 25}
							transform={`rotate(${index * 24} 320 240)`}
							opacity={1 - index * 0.13}
						/>
					))}
					<circle cx="320" cy="240" r="16" fill="var(--scene-primary)" />
					<path d="M70 240H160M480 240H570M320 40V90M320 390V440" strokeDasharray="4 5" />
				</g>
			) : (
				<g>
					<circle cx="320" cy="240" r="174" fill={`url(#${id})`} />
					<rect
						x="130"
						y="125"
						width="280"
						height="250"
						rx="18"
						fill="var(--scene-bg)"
						stroke="var(--scene-line)"
						transform="rotate(-9 270 250)"
					/>
					<rect
						x="220"
						y="90"
						width="290"
						height="278"
						rx="18"
						fill="var(--scene-surface)"
						stroke="var(--scene-line)"
						transform="rotate(7 365 230)"
					/>
					<g transform="rotate(7 365 230)">
						<circle cx="259" cy="130" r="10" fill="var(--scene-primary)" />
						<path
							d="M282 127H380M282 139H338"
							stroke="var(--scene-ink)"
							opacity=".35"
							strokeWidth="5"
						/>
						{[80, 116, 65, 145, 104, 162].map((height, index) => (
							<rect
								key={index}
								x={250 + index * 38}
								y={326 - height}
								width="25"
								height={height}
								rx="4"
								fill="var(--scene-primary)"
								opacity={0.3 + index * 0.12}
							/>
						))}
					</g>
				</g>
			)}
		</svg>
	)
}
