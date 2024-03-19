import { memo, useMemo } from "react"
import type { MagicAvatarProps } from "components"
import { MagicAvatar } from "components"
import { AiModel } from "@/const/aiModel"

import officialIcon from "@/assets/logos/favicon.svg"
import openaiIcon from "@/assets/services/Openai.png"
import azureIcon from "@/assets/services/Azure.png"
import volcengineIcon from "@/assets/services/Volcengine.png"
import alibabacloudIcon from "@/assets/services/Alibabacloud.png"
import deepseekIcon from "@/assets/services/Deepseek.png"
import awsIcon from "@/assets/services/AWS.png"
import googleIcon from "@/assets/services/Google.png"
import openrouterIcon from "@/assets/services/Openrouter.png"
import miraclevisionIcon from "@/assets/services/Miraclevision2.png"
import defaultIcon from "@/assets/services/Default.png"
import ttapiIcon from "@/assets/services/TTapi.png"

interface ServiceIconProps extends MagicAvatarProps {
	/** 服务商代码 */
	code: AiModel.ServiceProvider | string
	/** 服务商类型 */
	type?: AiModel.ProviderType | number
}

const serviceIconMap: Partial<Record<string, string>> = {
	[AiModel.ServiceProvider.Official]: officialIcon,
	[AiModel.ServiceProvider.OpenAI]: openaiIcon,
	[AiModel.ServiceProvider.MicrosoftAzure]: azureIcon,
	[AiModel.ServiceProvider.Volcengine]: volcengineIcon,
	[AiModel.ServiceProvider.VolcengineArk]: volcengineIcon,
	[AiModel.ServiceProvider.Qwen]: alibabacloudIcon,
	[AiModel.ServiceProvider.DashScope]: alibabacloudIcon,
	[AiModel.ServiceProvider.QwenGlobal]: alibabacloudIcon,
	[AiModel.ServiceProvider.DeepSeek]: deepseekIcon,
	[AiModel.ServiceProvider.AWSBedrock]: awsIcon,
	[AiModel.ServiceProvider.GoogleImage]: googleIcon,
	[AiModel.ServiceProvider.Google]: googleIcon,
	[AiModel.ServiceProvider.Gemini]: googleIcon,
	[AiModel.ServiceProvider.OpenRouter]: openrouterIcon,
	[AiModel.ServiceProvider.MiracleVision]: miraclevisionIcon,
	[AiModel.ServiceProvider.Tencent]: defaultIcon,
	[AiModel.ServiceProvider.TTAPI]: ttapiIcon,
}

const ServiceIcon = memo(({ code, type, size = 18, ...props }: ServiceIconProps) => {
	const src = useMemo(() => {
		if (type && type === AiModel.ProviderType.Custom) {
			return defaultIcon
		}
		return serviceIconMap[code]
	}, [code, type])

	return (
		<MagicAvatar src={src} size={size} {...props}>
			{!src ? code : undefined}
		</MagicAvatar>
	)
})

export default ServiceIcon
