import * as React from "react"

export const HeadingSixIcon = React.memo(
	({ className, ...props }: React.SVGProps<SVGSVGElement>) => {
		return (
			<svg
				width="24"
				height="24"
				className={className}
				viewBox="0 0 24 24"
				fill="currentColor"
				xmlns="http://www.w3.org/2000/svg"
				{...props}
			>
				<path
					d="M5 6C5 5.44772 4.55228 5 4 5C3.44772 5 3 5.44772 3 6V18C3 18.5523 3.44772 19 4 19C4.55228 19 5 18.5523 5 18V13H11V18C11 18.5523 11.4477 19 12 19C12.5523 19 13 18.5523 13 18V6C13 5.44772 12.5523 5 12 5C11.4477 5 11 5.44772 11 6V11H5V6Z"
					fill="currentColor"
				/>
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M20.7071 9.29289C21.0976 9.68342 21.0976 10.3166 20.7071 10.7071C19.8392 11.575 19.2179 12.2949 18.7889 13.0073C18.8587 13.0025 18.929 13 19 13C20.6569 13 22 14.3431 22 16C22 17.6569 20.6569 19 19 19C17.3431 19 16 17.6569 16 16C16 14.6007 16.2837 13.4368 16.8676 12.3419C17.4384 11.2717 18.2728 10.3129 19.2929 9.29289C19.6834 8.90237 20.3166 8.90237 20.7071 9.29289ZM19 17C18.4477 17 18 16.5523 18 16C18 15.4477 18.4477 15 19 15C19.5523 15 20 15.4477 20 16C20 16.5523 19.5523 17 19 17Z"
					fill="currentColor"
				/>
			</svg>
		)
	},
)

HeadingSixIcon.displayName = "HeadingSixIcon"
