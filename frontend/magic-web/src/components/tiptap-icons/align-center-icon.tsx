import * as React from "react"

export const AlignCenterIcon = React.memo(
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
					fillRule="evenodd"
					clipRule="evenodd"
					d="M2 6C2 5.44772 2.44772 5 3 5H21C21.5523 5 22 5.44772 22 6C22 6.55228 21.5523 7 21 7H3C2.44772 7 2 6.55228 2 6Z"
					fill="currentColor"
				/>
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M6 12C6 11.4477 6.44772 11 7 11H17C17.5523 11 18 11.4477 18 12C18 12.5523 17.5523 13 17 13H7C6.44772 13 6 12.5523 6 12Z"
					fill="currentColor"
				/>
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M4 18C4 17.4477 4.44772 17 5 17H19C19.5523 17 20 17.4477 20 18C20 18.5523 19.5523 19 19 19H5C4.44772 19 4 18.5523 4 18Z"
					fill="currentColor"
				/>
			</svg>
		)
	},
)

AlignCenterIcon.displayName = "AlignCenterIcon"
