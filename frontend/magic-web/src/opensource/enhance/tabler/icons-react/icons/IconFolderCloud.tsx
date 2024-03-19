import type { IconProps } from "@tabler/icons-react"
import { memo } from "react"

const IconFolderCloud = memo(({ stroke = 1.5, color, size }: IconProps) => {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none">
			<path
				d="M7 19H5C4.46957 19 3.96086 18.7893 3.58579 18.4142C3.21071 18.0391 3 17.5304 3 17V6C3 5.46957 3.21071 4.96086 3.58579 4.58579C3.96086 4.21071 4.46957 4 5 4H9L12 7H19C19.5304 7 20.0391 7.21071 20.4142 7.58579C20.7893 7.96086 21 8.46957 21 9V12M13.0613 19.9978C11.6467 19.9978 10.5 18.9175 10.5 17.5846C10.5 16.2524 11.6467 15.172 13.0613 15.172C13.2775 14.2235 14.048 13.4494 15.0826 13.141C16.1166 12.8331 17.2584 13.0371 18.0768 13.6793C18.8952 14.3199 19.2659 15.2979 19.0503 16.2464H19.5948C20.6469 16.2464 21.5 17.0862 21.5 18.1229C21.5 19.1603 20.6469 20 19.5942 20H13.0613"
				stroke={color ?? "currentColor"}
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
})

export default IconFolderCloud
