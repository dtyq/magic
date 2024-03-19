import * as React from "react"

export const HeadingOneIcon = React.memo(
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
					d="M21.0001 10C21.0001 9.63121 20.7971 9.29235 20.472 9.11833C20.1468 8.94431 19.7523 8.96338 19.4454 9.16795L16.4454 11.168C15.9859 11.4743 15.8617 12.0952 16.1681 12.5547C16.4744 13.0142 17.0953 13.1384 17.5548 12.8321L19.0001 11.8685V18C19.0001 18.5523 19.4478 19 20.0001 19C20.5524 19 21.0001 18.5523 21.0001 18V10Z"
					fill="currentColor"
				/>
			</svg>
		)
	},
)

HeadingOneIcon.displayName = "HeadingOneIcon"
