import type { LucideProps } from "lucide-react"

export default function FrameDotted({ size = 15, color = "currentColor", ...props }: LucideProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 15 15"
			fill="none"
			{...props}
		>
			<path
				d="M13.9984 3.33171H11.3317M11.3317 3.33171H3.33171M11.3317 3.33171V0.665039M11.3317 3.33171V11.3317M3.33171 3.33171H0.665039M3.33171 3.33171V0.665039M3.33171 3.33171V11.3317M13.9984 11.3317H11.3317M11.3317 11.3317H3.33171M11.3317 11.3317V13.9984M3.33171 11.3317H0.665039M3.33171 11.3317V13.9984"
				stroke={color}
				strokeWidth="1.33"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeDasharray="2 6"
			/>
		</svg>
	)
}
