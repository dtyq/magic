import type { CoverContext } from "./types"
import { hasFeature } from "./types"

export default function EditorialCover({ layout, features, radius }: CoverContext) {
	const magazine = layout === "magazine"
	const imageX = magazine ? 34 : 430
	const copyX = magazine ? 480 : 54
	const oversized = hasFeature(features, "oversized-type")

	return (
		<>
			<rect
				x={imageX}
				y="28"
				width={magazine ? 408 : 336}
				height="444"
				rx={radius}
				fill="var(--scene-primary)"
				opacity=".9"
			/>
			<circle
				cx={imageX + (magazine ? 205 : 168)}
				cy="196"
				r="104"
				fill="var(--scene-bg)"
				opacity=".88"
			/>
			<path
				d={`M${imageX} 398 L${imageX + 126} 245 L${imageX + 242} 382 L${imageX + (magazine ? 408 : 336)} 272 V472 H${imageX}Z`}
				fill="var(--scene-ink)"
				opacity=".22"
			/>
			<g>
				<rect x={copyX} y="50" width="82" height="8" rx="4" fill="var(--scene-primary)" />
				<text
					x={copyX}
					y={oversized ? 190 : 166}
					fill="var(--scene-ink)"
					fontSize={oversized ? 122 : 96}
					fontWeight="var(--scene-weight)"
					letterSpacing="-8"
				>
					Aa
				</text>
				<rect
					x={copyX}
					y="232"
					width={magazine ? 250 : 290}
					height="10"
					rx="4"
					fill="var(--scene-ink)"
					opacity=".7"
				/>
				<rect
					x={copyX}
					y="254"
					width={magazine ? 212 : 248}
					height="7"
					rx="3"
					fill="var(--scene-ink)"
					opacity=".22"
				/>
				<rect
					x={copyX}
					y="271"
					width={magazine ? 232 : 266}
					height="7"
					rx="3"
					fill="var(--scene-ink)"
					opacity=".22"
				/>
				<rect
					x={copyX}
					y="314"
					width="92"
					height="34"
					rx={Math.min(radius, 12)}
					fill="var(--scene-primary)"
				/>
				<rect
					x={copyX}
					y="404"
					width={magazine ? 232 : 300}
					height="1"
					fill="var(--scene-line)"
				/>
			</g>
		</>
	)
}
