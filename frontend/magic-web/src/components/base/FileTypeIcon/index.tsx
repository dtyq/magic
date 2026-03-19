import { memo, useMemo } from "react"
import type { FileTypeIconProps } from "./types"
import { generateColorFromString, getFileColor } from "./utils/colorGenerator"
import { getDisplayText, normalizeFiletype } from "./utils/fileTypeHelpers"

const VIEWBOX_SIZE = 24

function FileTypeIcon(props: FileTypeIconProps) {
	const { type: filetype, size = 16, color, icon, className, style, title } = props

	const resolvedSize = size
	const normalizedFiletype = useMemo(() => normalizeFiletype(filetype), [filetype])

	// Generate color based on file extension for consistent output
	const generatedColor = useMemo(
		() =>
			color ||
			getFileColor(normalizedFiletype) ||
			generateColorFromString(normalizedFiletype || ""),
		[color, normalizedFiletype],
	)

	const content = useMemo(() => {
		// Show file extension or first 2-3 characters
		const displayText = getDisplayText(normalizedFiletype)
		return displayText
	}, [normalizedFiletype])

	const accessibilityProps = title
		? { role: "img", "aria-label": title }
		: { "aria-hidden": true }

	const textSize = useMemo(() => {
		if (!content) return VIEWBOX_SIZE * 0.3
		if (content.length <= 2) return VIEWBOX_SIZE * 0.33
		if (content.length === 3) return VIEWBOX_SIZE * 0.3
		if (content.length === 4) return VIEWBOX_SIZE * 0.22
		return VIEWBOX_SIZE * 0.18
	}, [content])

	return (
		<svg
			width={resolvedSize}
			height={resolvedSize}
			viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			style={{ ...style }}
			className={className}
			{...accessibilityProps}
		>
			<g clipPath="url(#clip0_1764_869)">
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M15.763 0L23 7.237V22C23 22.5304 22.7893 23.0391 22.4142 23.4142C22.0391 23.7893 21.5304 24 21 24H3C2.46957 24 1.96086 23.7893 1.58579 23.4142C1.21071 23.0391 1 22.5304 1 22V2C1 1.46957 1.21071 0.960859 1.58579 0.585786C1.96086 0.210714 2.46957 0 3 0L15.763 0Z"
					fill={generatedColor}
				/>
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M17.763 7.237C17.2326 7.237 16.7239 7.02629 16.3488 6.65121C15.9737 6.27614 15.763 5.76743 15.763 5.237V0L23 7.237H17.763Z"
					fill="white"
					fillOpacity="0.401"
				/>
				<text
					fill="#fff"
					fontSize={textSize}
					fontWeight="bold"
					textAnchor="middle"
					x="50%"
					y="75%"
				>
					{content}
				</text>
			</g>
			<defs>
				<clipPath id="clip0_1764_869">
					<rect width="24" height="24" fill="white" />
				</clipPath>
			</defs>
		</svg>
	)
}

export default memo(FileTypeIcon)
