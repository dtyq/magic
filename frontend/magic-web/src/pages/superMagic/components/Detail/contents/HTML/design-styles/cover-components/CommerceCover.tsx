import type { CoverContext } from "./types"
import { hasFeature } from "./types"

export default function CommerceCover({ layout, features, radius }: CoverContext) {
	const centered = layout === "centered" || layout === "stacked"

	return (
		<>
			<rect
				x="30"
				y="26"
				width="740"
				height="448"
				rx={radius}
				fill="var(--scene-surface)"
				stroke="var(--scene-line)"
			/>
			<rect
				x={centered ? 84 : 46}
				y={centered ? 44 : 60}
				width={centered ? 632 : 350}
				height={centered ? 258 : 370}
				rx={radius}
				fill="var(--scene-primary)"
				opacity={hasFeature(features, "color-blocks") ? 1 : 0.82}
			/>
			<ellipse
				cx={centered ? 400 : 222}
				cy={centered ? 266 : 336}
				rx="108"
				ry="18"
				fill="var(--scene-ink)"
				opacity=".13"
			/>
			<path
				d={
					centered
						? "M330 104H470L494 262Q494 292 462 292H338Q306 292 306 262Z"
						: "M158 122H286L304 330Q304 360 276 360H168Q140 360 140 330Z"
				}
				fill="var(--scene-bg)"
				opacity=".93"
			/>
			<ellipse
				cx={centered ? 400 : 222}
				cy={centered ? 106 : 124}
				rx="70"
				ry="18"
				fill="var(--scene-surface)"
			/>
			{centered ? (
				<g>
					{[0, 1, 2].map((item) => (
						<rect
							key={item}
							x={120 + item * 198}
							y="338"
							width="164"
							height="102"
							rx={radius}
							fill="var(--scene-bg)"
							stroke="var(--scene-line)"
						/>
					))}
				</g>
			) : (
				<g>
					<rect x="438" y="88" width="86" height="8" rx="4" fill="var(--scene-primary)" />
					<rect
						x="438"
						y="124"
						width="250"
						height="24"
						rx="7"
						fill="var(--scene-ink)"
						opacity=".84"
					/>
					<rect
						x="438"
						y="166"
						width="214"
						height="8"
						rx="4"
						fill="var(--scene-ink)"
						opacity=".2"
					/>
					<rect
						x="438"
						y="187"
						width="244"
						height="8"
						rx="4"
						fill="var(--scene-ink)"
						opacity=".2"
					/>
					<rect
						x="438"
						y="246"
						width="118"
						height="42"
						rx={Math.min(radius, 14)}
						fill="var(--scene-primary)"
					/>
					<rect x="438" y="338" width="250" height="1" fill="var(--scene-line)" />
				</g>
			)}
		</>
	)
}
