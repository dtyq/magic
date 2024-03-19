import { useId } from "react"

function VipIcon() {
	const uniqueId = useId()
	const gradientFillId = `vip-icon-gradient-fill-${uniqueId}`

	return (
		<svg
			width="28"
			height="14"
			viewBox="0 0 28 14"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M0 7C0 3.13401 3.13401 0 7 0H21C24.866 0 28 3.13401 28 7C28 10.866 24.866 14 21 14H7C3.13401 14 0 10.866 0 7Z"
				fill={`url(#${gradientFillId})`}
			/>
			<path
				d="M8.84008 11L6.28008 3.9H7.43008L9.52008 9.8L11.6101 3.9H12.7601L10.1901 11H8.84008ZM13.5807 11V3.9H14.6607V11H13.5807ZM16.2077 11V3.9H18.8577C19.671 3.9 20.3043 4.09667 20.7577 4.49C21.211 4.87667 21.4377 5.41667 21.4377 6.11C21.4377 6.57 21.3343 6.97 21.1277 7.31C20.921 7.64333 20.6243 7.9 20.2377 8.08C19.8577 8.25333 19.3977 8.34 18.8577 8.34H17.2877V11H16.2077ZM17.2877 7.36H18.8277C19.3143 7.36 19.6843 7.25667 19.9377 7.05C20.191 6.83667 20.3177 6.52333 20.3177 6.11C20.3177 5.70333 20.191 5.4 19.9377 5.2C19.6843 4.99333 19.3143 4.89 18.8277 4.89H17.2877V7.36Z"
				fill="#FAFAFA"
			/>
			<defs>
				<linearGradient
					id={gradientFillId}
					x1="8.22222"
					y1="3.8125"
					x2="29.2284"
					y2="9.28407"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#261F46" />
					<stop offset="0.636182" stopColor="#241AD6" />
					<stop offset="1" stopColor="#A517FD" />
				</linearGradient>
			</defs>
		</svg>
	)
}

export default VipIcon
