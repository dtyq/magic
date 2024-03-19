import * as React from "react"

export const HeadingIcon = React.memo(({ className, ...props }: React.SVGProps<SVGSVGElement>) => {
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
				d="M6 3C6.55228 3 7 3.44772 7 4V11H17V4C17 3.44772 17.4477 3 18 3C18.5523 3 19 3.44772 19 4V20C19 20.5523 18.5523 21 18 21C17.4477 21 17 20.5523 17 20V13H7V20C7 20.5523 6.55228 21 6 21C5.44772 21 5 20.5523 5 20V4C5 3.44772 5.44772 3 6 3Z"
				fill="currentColor"
			/>
		</svg>
	)
})

HeadingIcon.displayName = "HeadingIcon"
