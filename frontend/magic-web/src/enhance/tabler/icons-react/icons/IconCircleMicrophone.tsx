import type { IconProps } from "@tabler/icons-react"
import { memo } from "react"

const IconCircleMicrophone = memo((props: IconProps) => {
	const { stroke = 1.5, color, size, ...rest } = props
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 28 28"
			fill="none"
			{...rest}
		>
			<path
				d="M9.33333 13.0789C9.33333 14.2189 9.825 15.3122 10.7002 16.1183C11.5753 16.9243 12.7623 17.3772 14 17.3772M14 17.3772C15.2377 17.3772 16.4247 16.9243 17.2998 16.1183C18.175 15.3122 18.6667 14.2189 18.6667 13.0789M14 17.3772V19.8333M11.3333 19.8333H16.6667M12 10.0088C12 9.52022 12.2107 9.05167 12.5858 8.70621C12.9609 8.36074 13.4696 8.16667 14 8.16667C14.5304 8.16667 15.0391 8.36074 15.4142 8.70621C15.7893 9.05167 16 9.52022 16 10.0088V13.0789C16 13.5675 15.7893 14.0361 15.4142 14.3815C15.0391 14.727 14.5304 14.9211 14 14.9211C13.4696 14.9211 12.9609 14.727 12.5858 14.3815C12.2107 14.0361 12 13.5675 12 13.0789V10.0088ZM24.5 14C24.5 19.799 19.799 24.5 14 24.5C8.20101 24.5 3.5 19.799 3.5 14C3.5 8.20101 8.20101 3.5 14 3.5C19.799 3.5 24.5 8.20101 24.5 14Z"
				stroke={color ?? "currentColor"}
				strokeOpacity="0.8"
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
})

export default IconCircleMicrophone
