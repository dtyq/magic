import IconSparklesGradient from "@/enhance/tabler/icons-react/icons/IconSparklesGradient"
import MagicIcon from "@/components/base/MagicIcon"
import { IconSparkles } from "@tabler/icons-react"
import { useUpdate } from "ahooks"
import { ModelItem } from "../types"
import { isMaxModel } from "../utils"

interface ModelIconProps {
	model: ModelItem
	className?: string
	size?: number
	defaultColor?: string
}

const failedImages = new Set<string>()

function ModelIcon({ model, className, size = 16, defaultColor }: ModelIconProps) {
	const hasValidIcon = model.model_icon && model.model_icon.trim() !== ""
	const imageLoadFailed = failedImages.has(model.model_icon)
	const update = useUpdate()

	const handleImageError = (icon: string) => {
		failedImages.add(icon)
		update()
	}

	if (!hasValidIcon && isMaxModel(model)) {
		return <MagicIcon component={IconSparklesGradient} className={className} size={size} />
	}

	if (!hasValidIcon || imageLoadFailed) {
		return (
			<MagicIcon
				component={IconSparkles}
				className={className}
				size={size}
				color={defaultColor || "rgba(28, 29, 35, 0.6)"}
			/>
		)
	}

	return (
		<img
			className={className}
			src={model.model_icon}
			alt={model.model_name || "Model icon"}
			onError={() => handleImageError(model.model_icon)}
			style={{
				width: size,
				height: size,
			}}
		/>
	)
}

export default ModelIcon
