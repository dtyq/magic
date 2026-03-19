import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

const IconLocalFile = memo(({ size = 24 }: IconProps) => {
	const height = Number(size)
	return (
		<svg
			width={(height * 22) / 24}
			height={height}
			viewBox={`0 0 ${(22 * height) / 24} ${height}`}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<g clipPath="url(#clip0_20664_150605)">
				<path
					d="M21.2088 5.5441C21.6098 5.94019 21.8357 6.47442 21.838 7.03181V21.5973C21.8706 22.199 21.6587 22.7888 21.2484 23.2383C20.8382 23.6877 20.2628 23.9602 19.6479 23.9964H2.82839C2.21415 23.9602 1.63959 23.6874 1.23059 23.2378C0.821582 22.7881 0.611481 22.1982 0.646309 21.5973V3.1295C0.611481 2.52861 0.821582 1.93872 1.23059 1.48905C1.63959 1.03938 2.21415 0.766604 2.82839 0.730469H15.2201C15.8767 0.731797 16.5063 0.986512 16.9721 1.43927L21.2088 5.5441Z"
					fill="#FF7D00"
				/>
				<path
					d="M4.13424 5.55078H10.6486C11.0415 5.55078 11.238 5.74291 11.238 6.12717V6.92165C11.238 7.30591 11.0415 7.49804 10.6486 7.49804H4.13424C3.74136 7.49804 3.54492 7.30591 3.54492 6.92165V6.12717C3.54492 5.74291 3.74136 5.55078 4.13424 5.55078Z"
					fill="#FFF8EB"
				/>
			</g>
			<defs>
				<clipPath id="clip0_20664_150605">
					<rect width={(height * 22) / 24} height={height} fill="white" />
				</clipPath>
			</defs>
		</svg>
	)
})

IconLocalFile.displayName = "IconLocalFile"
export default IconLocalFile
