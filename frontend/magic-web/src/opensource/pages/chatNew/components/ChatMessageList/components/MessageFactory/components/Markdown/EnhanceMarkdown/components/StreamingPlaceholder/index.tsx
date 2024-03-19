import TextAnimation from "@/opensource/components/animations/TextAnimation"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { memo } from "react"

const StreamingPlaceholder = memo(({ tip }: { tip: string }) => {
	return (
		<MagicSpin spinning tip={<TextAnimation dotwaveAnimation>{tip}</TextAnimation>}>
			<div style={{ width: "100%", height: 360, minWidth: 360 }} />
		</MagicSpin>
	)
})

export default StreamingPlaceholder
