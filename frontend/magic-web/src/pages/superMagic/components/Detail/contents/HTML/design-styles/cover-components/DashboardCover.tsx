import type { CoverContext } from "./types"
import { hasFeature } from "./types"

export default function DashboardCover({ layout, features, radius }: CoverContext) {
	const sidebar = layout === "sidebar"
	const origin = sidebar ? 188 : 44
	const width = sidebar ? 568 : 712

	return (
		<>
			{sidebar && (
				<g>
					<rect
						x="32"
						y="28"
						width="128"
						height="444"
						rx={radius}
						fill="var(--scene-surface)"
						stroke="var(--scene-line)"
					/>
					<circle cx="60" cy="62" r="12" fill="var(--scene-primary)" />
					<rect
						x="84"
						y="55"
						width="50"
						height="9"
						rx="4"
						fill="var(--scene-ink)"
						opacity=".75"
					/>
					{[0, 1, 2, 3].map((row) => (
						<rect
							key={row}
							x="50"
							y={116 + row * 54}
							width="92"
							height="30"
							rx={Math.min(radius, 9)}
							fill={row === 0 ? "var(--scene-primary)" : "var(--scene-ink)"}
							opacity={row === 0 ? 1 : 0.08}
						/>
					))}
				</g>
			)}
			<g>
				<rect
					x={origin}
					y="28"
					width={width}
					height="444"
					rx={radius}
					fill="var(--scene-surface)"
					stroke="var(--scene-line)"
				/>
				<rect
					x={origin + 24}
					y="54"
					width={hasFeature(features, "oversized-type") ? 210 : 150}
					height="16"
					rx="6"
					fill="var(--scene-ink)"
					opacity=".85"
				/>
				<rect
					x={origin + 24}
					y="82"
					width="112"
					height="7"
					rx="3"
					fill="var(--scene-ink)"
					opacity=".22"
				/>
				{[0, 1, 2].map((column) => (
					<g key={column}>
						<rect
							x={origin + 24 + column * ((width - 60) / 3)}
							y="120"
							width={(width - 94) / 3}
							height="92"
							rx={radius}
							fill="var(--scene-bg)"
							stroke="var(--scene-line)"
						/>
						<rect
							x={origin + 40 + column * ((width - 60) / 3)}
							y="143"
							width="46"
							height="7"
							rx="3"
							fill="var(--scene-ink)"
							opacity=".22"
						/>
						<rect
							x={origin + 40 + column * ((width - 60) / 3)}
							y="166"
							width="78"
							height="21"
							rx="5"
							fill="var(--scene-ink)"
							opacity=".8"
						/>
					</g>
				))}
				<rect
					x={origin + 24}
					y="236"
					width={width - 48}
					height="206"
					rx={radius}
					fill="var(--scene-bg)"
					stroke="var(--scene-line)"
				/>
				<path
					d={`M${origin + 52} 393 C${origin + 128} 360 ${origin + 168} 402 ${origin + 234} 328 S${origin + 364} 296 ${origin + 422} 244 S${origin + 482} 292 ${origin + width - 42} 256`}
					fill="none"
					stroke="var(--scene-primary)"
					strokeWidth="8"
					strokeLinecap="round"
				/>
				<path
					d={`M${origin + 52} 410H${origin + width - 42}`}
					stroke="var(--scene-line)"
					strokeDasharray="6 8"
				/>
			</g>
		</>
	)
}
