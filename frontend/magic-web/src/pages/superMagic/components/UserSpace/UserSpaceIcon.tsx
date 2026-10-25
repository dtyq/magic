import type { SVGProps } from "react"

interface UserSpaceIconProps extends SVGProps<SVGSVGElement> {
	size?: number
}

/** 云朵内的用户标识用于区分个人空间与项目文件。 */
export default function UserSpaceIcon({
	size = 16,
	strokeWidth = 1.5,
	...props
}: UserSpaceIconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...props}
		>
			<path d="M6.5 20.5C3.74 20.5 1.5 18.26 1.5 15.5C1.5 13.09 3.2 11.08 5.47 10.6C5.8 6.9 8.1 3.5 12 3.5C15.2 3.5 17.6 5.8 18.1 8.9C20.7 9.25 22.5 11.5 22.5 14.25C22.5 17.7 20.25 20.5 17 20.5Z" />
			<circle cx="12" cy="10" r="1.75" />
			<path d="M8.5 17.5v-.75c0-1.3 1.55-2.25 3.5-2.25s3.5.95 3.5 2.25v.75" />
		</svg>
	)
}
