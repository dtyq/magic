import { memo, useMemo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconLayoutGridGradient({ size = 16 }: IconProps) {
	// Generate unique IDs for this component instance to avoid SVG gradient conflicts
	const gradientIds = useMemo(() => {
		const uniqueId = Math.random().toString(36).substr(2, 9)
		return {
			paint0: `paint0_linear_grid_${uniqueId}`,
			paint1: `paint1_linear_grid_${uniqueId}`,
			paint2: `paint2_linear_grid_${uniqueId}`,
			paint3: `paint3_linear_grid_${uniqueId}`,
		}
	}, [])

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
		>
			<path
				d="M2.66797 3.33268C2.66797 3.15587 2.73821 2.9863 2.86323 2.86128C2.98826 2.73625 3.15782 2.66602 3.33464 2.66602H6.0013C6.17811 2.66602 6.34768 2.73625 6.47271 2.86128C6.59773 2.9863 6.66797 3.15587 6.66797 3.33268V5.99935C6.66797 6.17616 6.59773 6.34573 6.47271 6.47075C6.34768 6.59578 6.17811 6.66602 6.0013 6.66602H3.33464C3.15782 6.66602 2.98826 6.59578 2.86323 6.47075C2.73821 6.34573 2.66797 6.17616 2.66797 5.99935V3.33268Z"
				stroke={`url(#${gradientIds.paint0})`}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M9.33203 3.33268C9.33203 3.15587 9.40227 2.9863 9.52729 2.86128C9.65232 2.73625 9.82189 2.66602 9.9987 2.66602H12.6654C12.8422 2.66602 13.0117 2.73625 13.1368 2.86128C13.2618 2.9863 13.332 3.15587 13.332 3.33268V5.99935C13.332 6.17616 13.2618 6.34573 13.1368 6.47075C13.0117 6.59578 12.8422 6.66602 12.6654 6.66602H9.9987C9.82189 6.66602 9.65232 6.59578 9.52729 6.47075C9.40227 6.34573 9.33203 6.17616 9.33203 5.99935V3.33268Z"
				stroke={`url(#${gradientIds.paint1})`}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M2.66797 10.0007C2.66797 9.82384 2.73821 9.65427 2.86323 9.52925C2.98826 9.40422 3.15782 9.33398 3.33464 9.33398H6.0013C6.17811 9.33398 6.34768 9.40422 6.47271 9.52925C6.59773 9.65427 6.66797 9.82384 6.66797 10.0007V12.6673C6.66797 12.8441 6.59773 13.0137 6.47271 13.1387C6.34768 13.2637 6.17811 13.334 6.0013 13.334H3.33464C3.15782 13.334 2.98826 13.2637 2.86323 13.1387C2.73821 13.0137 2.66797 12.8441 2.66797 12.6673V10.0007Z"
				stroke={`url(#${gradientIds.paint2})`}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M9.33203 10.0007C9.33203 9.82384 9.40227 9.65427 9.52729 9.52925C9.65232 9.40422 9.82189 9.33398 9.9987 9.33398H12.6654C12.8422 9.33398 13.0117 9.40422 13.1368 9.52925C13.2618 9.65427 13.332 9.82384 13.332 10.0007V12.6673C13.332 12.8441 13.2618 13.0137 13.1368 13.1387C13.0117 13.2637 12.8422 13.334 12.6654 13.334H9.9987C9.82189 13.334 9.65232 13.2637 9.52729 13.1387C9.40227 13.0137 9.33203 12.8441 9.33203 12.6673V10.0007Z"
				stroke={`url(#${gradientIds.paint3})`}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<defs>
				<linearGradient
					id={gradientIds.paint0}
					x1="2.88484"
					y1="2.89818"
					x2="6.82745"
					y2="6.01935"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
				<linearGradient
					id={gradientIds.paint1}
					x1="9.5489"
					y1="2.89818"
					x2="13.4915"
					y2="6.01935"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
				<linearGradient
					id={gradientIds.paint2}
					x1="2.88484"
					y1="9.56615"
					x2="6.82745"
					y2="12.6873"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
				<linearGradient
					id={gradientIds.paint3}
					x1="9.5489"
					y1="9.56615"
					x2="13.4915"
					y2="12.6873"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
			</defs>
		</svg>
	)
}

export default memo(IconLayoutGridGradient)
