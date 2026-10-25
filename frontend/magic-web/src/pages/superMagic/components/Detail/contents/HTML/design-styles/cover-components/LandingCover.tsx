import type { CoverContext } from "./types"
import { hasFeature } from "./types"

function TerminalCover({ radius }: Pick<CoverContext, "radius">) {
	return (
		<g>
			<rect
				x="34"
				y="28"
				width="732"
				height="444"
				rx={radius}
				fill="var(--scene-surface)"
				stroke="var(--scene-line)"
			/>
			<circle cx="62" cy="56" r="5" fill="var(--scene-primary)" />
			<circle cx="80" cy="56" r="5" fill="var(--scene-ink)" opacity=".18" />
			<circle cx="98" cy="56" r="5" fill="var(--scene-ink)" opacity=".18" />
			{[0, 1, 2, 3, 4, 5].map((line) => (
				<g key={line}>
					<rect
						x="72"
						y={112 + line * 48}
						width={line % 2 ? 96 : 42}
						height="8"
						rx="4"
						fill="var(--scene-primary)"
						opacity={0.65 + line * 0.05}
					/>
					<rect
						x={line % 2 ? 186 : 126}
						y={112 + line * 48}
						width={210 + (line % 3) * 58}
						height="8"
						rx="4"
						fill="var(--scene-ink)"
						opacity=".25"
					/>
				</g>
			))}
			<circle
				cx="628"
				cy="290"
				r="76"
				fill="none"
				stroke="var(--scene-primary)"
				strokeWidth="3"
				opacity=".6"
			/>
			<circle
				cx="628"
				cy="290"
				r="46"
				fill="none"
				stroke="var(--scene-primary)"
				opacity=".45"
			/>
			<circle cx="628" cy="290" r="12" fill="var(--scene-primary)" />
		</g>
	)
}

export default function LandingCover({ layout, features, radius }: CoverContext) {
	const centered = layout === "centered"
	const terminal = hasFeature(features, "mono-type") || hasFeature(features, "dense-data")

	if (terminal) return <TerminalCover radius={radius} />

	return (
		<>
			<g transform={centered ? "translate(104 4)" : undefined}>
				<rect x="52" y="72" width="86" height="8" rx="4" fill="var(--scene-primary)" />
				<rect
					x="52"
					y="116"
					width={hasFeature(features, "oversized-type") ? 330 : 270}
					height="34"
					rx="8"
					fill="var(--scene-ink)"
					opacity=".88"
				/>
				<rect
					x="52"
					y="164"
					width="292"
					height="34"
					rx="8"
					fill="var(--scene-ink)"
					opacity=".88"
				/>
				<rect
					x="52"
					y="232"
					width="246"
					height="8"
					rx="4"
					fill="var(--scene-ink)"
					opacity=".2"
				/>
				<rect
					x="52"
					y="253"
					width="206"
					height="8"
					rx="4"
					fill="var(--scene-ink)"
					opacity=".2"
				/>
				<rect
					x="52"
					y="310"
					width="112"
					height="42"
					rx={Math.min(radius, 14)}
					fill="var(--scene-primary)"
				/>
			</g>
			{!centered && (
				<g>
					<circle
						cx="590"
						cy="248"
						r="174"
						fill="var(--scene-primary)"
						opacity={hasFeature(features, "soft-gradient") ? 0.25 : 0.12}
					/>
					<rect
						x="466"
						y="92"
						width="236"
						height="320"
						rx={radius}
						fill="var(--scene-surface)"
						stroke="var(--scene-line)"
						transform="rotate(7 584 252)"
					/>
					<circle cx="522" cy="144" r="16" fill="var(--scene-primary)" />
					<rect
						x="552"
						y="136"
						width="88"
						height="8"
						rx="4"
						fill="var(--scene-ink)"
						opacity=".45"
					/>
					{[80, 112, 66, 146, 102].map((height, index) => (
						<rect
							key={height}
							x={500 + index * 38}
							y={352 - height}
							width="24"
							height={height}
							rx="4"
							fill="var(--scene-primary)"
							opacity={0.3 + index * 0.13}
						/>
					))}
				</g>
			)}
		</>
	)
}
