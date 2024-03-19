import * as React from "react"

export const CopyMarkdownIcon = React.memo(
	({ className, ...props }: React.SVGProps<SVGSVGElement>) => {
		return (
			<svg
				width="24"
				height="24"
				className={className}
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				{...props}
			>
				<path
					d="M8 5C8 3.34315 9.34315 2 11 2H17C18.6569 2 20 3.34315 20 5V15C20 16.6569 18.6569 18 17 18H11C9.34315 18 8 16.6569 8 15V5Z"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M16 18V19C16 20.6569 14.6569 22 13 22H7C5.34315 22 4 20.6569 4 19V9C4 7.34315 5.34315 6 7 6H8"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M12 7L13 8L15 6"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M11 11H17"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M11 14H15"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		)
	},
)

CopyMarkdownIcon.displayName = "CopyMarkdownIcon"
