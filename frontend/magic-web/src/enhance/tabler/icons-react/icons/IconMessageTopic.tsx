import type { IconProps } from "@tabler/icons-react"
import { memo } from "react"

const IconMessageTopic = memo(({ stroke = 2, color, size, ...props }: IconProps) => {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
			<path
				d="M8 9H16M8 13H14M12.01 18.594L8 21V18H6C5.20435 18 4.44129 17.6839 3.87868 17.1213C3.31607 16.5587 3 15.7956 3 15V7C3 6.20435 3.31607 5.44129 3.87868 4.87868C4.44129 4.31607 5.20435 4 6 4H18C18.7956 4 19.5587 4.31607 20.1213 4.87868C20.6839 5.44129 21 6.20435 21 7V12.5M15 17.1875H22M15 19.8125H22M18 15L16 22M21 15L19 22"
				stroke={color ?? "currentColor"}
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
})

export default IconMessageTopic
