import { memo } from "react"
import type { TabIconProps } from "./types"

export const ApprovalIcon = memo(({ active = false, size = 21 }: TabIconProps) => {
	if (active) {
		return (
			<div className="inline-flex size-9 items-center justify-center rounded-[10px] bg-red-50">
				<svg
					width={size}
					height={size}
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M5 22H19M14 13V8.5C14 7 15 7 15 5C15 4.20435 14.6839 3.44129 14.1213 2.87868C13.5587 2.31607 12.7956 2 12 2C10.34 2 9 3 9 5C9 7 10 7 10 8.5V13M19.27 13.73C19.0374 13.498 18.7614 13.3141 18.4577 13.1888C18.1539 13.0636 17.8285 12.9994 17.5 13H6.5C5.83696 13 5.20107 13.2634 4.73223 13.7322C4.26339 14.2011 4 14.837 4 15.5V17C4 17.2652 4.10536 17.5196 4.29289 17.7071C4.48043 17.8946 4.73478 18 5 18H19C19.2652 18 19.5196 17.8946 19.7071 17.7071C19.8946 17.5196 20 17.2652 20 17V15.5C20 14.84 19.74 14.2 19.27 13.73Z"
						stroke="#DC2626"
						strokeWidth={1.5}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</div>
		)
	}

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M5 22H19M14 13V8.5C14 7 15 7 15 5C15 4.20435 14.6839 3.44129 14.1213 2.87868C13.5587 2.31607 12.7956 2 12 2C10.34 2 9 3 9 5C9 7 10 7 10 8.5V13M19.27 13.73C19.0374 13.498 18.7614 13.3141 18.4577 13.1888C18.1539 13.0636 17.8285 12.9994 17.5 13H6.5C5.83696 13 5.20107 13.2634 4.73223 13.7322C4.26339 14.2011 4 14.837 4 15.5V17C4 17.2652 4.10536 17.5196 4.29289 17.7071C4.48043 17.8946 4.73478 18 5 18H19C19.2652 18 19.5196 17.8946 19.7071 17.7071C19.8946 17.5196 20 17.2652 20 17V15.5C20 14.84 19.74 14.2 19.27 13.73Z"
				stroke="#1C1D23"
				strokeOpacity={0.35}
				strokeWidth={1.5}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
})

ApprovalIcon.displayName = "ApprovalIcon"
