import { memo } from "react"
import streamLoadingIcon from "@/opensource/assets/resources/stream-loading-2.png"

const StreamTextAnimation = memo(({ style, ...props }: React.HTMLAttributes<HTMLImageElement>) => {
	return (
		<img
			src={streamLoadingIcon}
			alt=""
			style={{ width: 16.5, height: 16.5, scale: 1.3, display: "inline-block", ...style }}
			{...props}
		/>
	)
})

export default StreamTextAnimation
