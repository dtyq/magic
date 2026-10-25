import type { StyleProfile } from "./styleProfiles"

/** Shared artwork: the gallery and detail use the same scene, geometry and palette. */
export default function DesignStyleArtwork({ profile }: { profile?: StyleProfile }) {
	const scene = profile?.scene
	const features = profile?.features ?? []
	const radius = features.includes("sharp-corners")
		? 0
		: features.includes("rounded-cards")
			? 24
			: 8
	if (scene === "dashboard")
		return (
			<g>
				<rect
					x="12"
					y="24"
					width="38"
					height="226"
					rx={radius}
					fill="var(--scene-primary)"
					opacity=".18"
				/>
				{[70, 146, 222].map((x) => (
					<rect
						key={x}
						x={x}
						y="24"
						width="62"
						height="48"
						rx={radius}
						fill="var(--scene-primary)"
						opacity=".3"
					/>
				))}
				<path d="M70 235H286M70 165H286M70 100H286" stroke="var(--scene-line)" />
				<path
					d="M70 222L104 198L140 207L174 142L208 156L248 109L286 90"
					fill="none"
					stroke="var(--scene-primary)"
					strokeWidth="5"
				/>
			</g>
		)
	if (scene === "commerce")
		return (
			<g>
				{[18, 114, 210].map((x, index) => (
					<g key={x} transform={`translate(${x},${index === 1 ? 45 : 72})`}>
						<rect
							width="78"
							height="174"
							rx={radius}
							fill="var(--scene-primary)"
							opacity={index === 1 ? 1 : 0.55}
						/>
						<path d="M27 50Q39 42 51 50L58 127Q39 137 20 127Z" fill="var(--scene-bg)" />
					</g>
				))}
			</g>
		)
	if (
		scene === "terminal" ||
		features.includes("hairline-grid") ||
		features.includes("mono-type")
	)
		return (
			<g>
				<path
					d="M0 60H300M0 120H300M0 180H300M0 240H300M60 0V300M120 0V300M180 0V300M240 0V300"
					stroke="var(--scene-line)"
				/>
				<g transform="rotate(-22 150 150)">
					<rect
						x="74"
						y="74"
						width="162"
						height="162"
						rx={radius}
						fill="var(--scene-primary)"
						opacity=".35"
					/>
					<rect
						x="60"
						y="60"
						width="162"
						height="162"
						rx={radius}
						fill="var(--scene-bg)"
						stroke="var(--scene-primary)"
						strokeWidth="2"
					/>
				</g>
			</g>
		)
	if (scene === "portfolio" || features.includes("color-blocks"))
		return (
			<g>
				<rect
					x="18"
					y="40"
					width="126"
					height="220"
					rx={radius}
					fill="var(--scene-primary)"
				/>
				<path
					d="M160 260V132A64 64 0 0 1 288 132V260Z"
					fill="var(--scene-primary)"
					opacity=".45"
				/>
				<circle cx="81" cy="114" r="34" fill="var(--scene-bg)" />
			</g>
		)
	return (
		<g>
			<rect x="18" y="18" width="264" height="264" rx={radius} fill="var(--scene-primary)" />
			<circle cx="150" cy="139" r="83" fill="var(--scene-bg)" />
			<path
				d={
					profile?.layout === "magazine"
						? "M18 282L282 132V282Z"
						: "M18 282L150 148L282 282Z"
				}
				fill="var(--scene-ink)"
				opacity=".22"
			/>
		</g>
	)
}
