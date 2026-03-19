import MagicIcon from "@/components/base/MagicIcon"
import { IconSparkles } from "@tabler/icons-react"
import { useUpdate } from "ahooks"
import { ModeModelGroup } from "../types"

interface ProviderIconProps {
	provider: ModeModelGroup
	className?: string
	size?: number
}

const failedImages = new Set<string>()

function ProviderIcon({ provider, className, size = 16 }: ProviderIconProps) {
	const hasValidIcon = provider.icon && provider.icon.trim() !== ""
	const imageLoadFailed = failedImages.has(provider.icon)
	const update = useUpdate()

	const handleImageError = (icon: string) => {
		failedImages.add(icon)
		update()
	}

	if (!hasValidIcon || imageLoadFailed) {
		return (
			<MagicIcon
				component={IconSparkles}
				className={className}
				size={size}
				color="rgba(28, 29, 35, 0.6)"
			/>
		)
	}

	// if (isRecommendedProvider(provider)) {
	// 	return (
	// 		<MagicIcon
	// 			component={IconSparklesGradient}
	// 			className={className}
	// 			size={size}
	// 			color="rgba(28, 29, 35, 0.6)"
	// 		/>
	// 	)
	// }

	return (
		<img
			className={className}
			src={provider.icon}
			alt={provider.name || "Provider icon"}
			onError={() => handleImageError(provider.icon)}
			style={{
				width: size,
				height: size,
			}}
		/>
	)
}

export default ProviderIcon
