import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconToggle({ size }: IconProps) {
	return (
		<svg viewBox="0 0 6 6" width={size} height={size}>
			<path
				opacity="0.6"
				d="M5.48682 2.01416C5.67581 1.82517 5.99951 1.95978 5.99951 2.22705V5.70264C5.99941 5.86813 5.86519 6.00228 5.69971 6.00244H2.22412C1.95702 6.00244 1.82277 5.67976 2.01123 5.49072L5.48682 2.01416ZM3.77588 -0.00244141C4.04296 -0.00244141 4.17715 0.320231 3.98877 0.509277L0.512207 3.98584C0.32316 4.17422 0.000488281 4.04003 0.000488281 3.77295V0.297363C0.000593752 0.131833 0.134763 -0.00233581 0.300293 -0.00244141H3.77588Z"
				fill="currentColor"
			/>
		</svg>
	)
}

export default memo(IconToggle)
