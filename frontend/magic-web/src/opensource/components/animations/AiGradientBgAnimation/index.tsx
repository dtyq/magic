import type { VideoHTMLAttributes } from "react"
import { memo } from "react"
import video from "@/opensource/assets/resources/ai-generate-loading.mp4?url"

const AiGradientBgAnimation = memo((props: VideoHTMLAttributes<HTMLVideoElement>) => {
	return (
		<video autoPlay muted loop {...props}>
			<source src={video} type="video/mp4" />
		</video>
	)
})

export default AiGradientBgAnimation
