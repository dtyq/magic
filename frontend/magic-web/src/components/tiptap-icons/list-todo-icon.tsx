import * as React from "react"

export const ListTodoIcon = React.memo(({ className, ...props }: React.SVGProps<SVGSVGElement>) => {
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
				d="M2 6C2 4.89543 2.89543 4 4 4H8C9.10457 4 10 4.89543 10 6V10C10 11.1046 9.10457 12 8 12H4C2.89543 12 2 11.1046 2 10V6ZM8 6H4V10H8V6Z"
				fill="currentColor"
			/>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M9.70711 14.2929C10.0976 14.6834 10.0976 15.3166 9.70711 15.7071L5.70711 19.7071C5.31658 20.0976 4.68342 20.0976 4.29289 19.7071L2.29289 17.7071C1.90237 17.3166 1.90237 16.6834 2.29289 16.2929C2.68342 15.9024 3.31658 15.9024 3.70711 16.2929L5 17.5858L8.29289 14.2929C8.68342 13.9024 9.31658 13.9024 9.70711 14.2929Z"
				fill="currentColor"
			/>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M12 6C12 5.44772 12.4477 5 13 5H21C21.5523 5 22 5.44772 22 6C22 6.55228 21.5523 7 21 7H13C12.4477 7 12 6.55228 12 6Z"
				fill="currentColor"
			/>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M12 12C12 11.4477 12.4477 11 13 11H21C21.5523 11 22 11.4477 22 12C22 12.5523 21.5523 13 21 13H13C12.4477 13 12 12.5523 12 12Z"
				fill="currentColor"
			/>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M12 18C12 17.4477 12.4477 17 13 17H21C21.5523 17 22 17.4477 22 18C22 18.5523 21.5523 19 21 19H13C12.4477 19 12 18.5523 12 18Z"
				fill="currentColor"
			/>
		</svg>
	)
})

ListTodoIcon.displayName = "ListTodoIcon"
