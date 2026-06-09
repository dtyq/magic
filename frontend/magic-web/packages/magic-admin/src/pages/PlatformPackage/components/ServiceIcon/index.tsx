import { memo, useMemo } from "react"
import type { MagicAvatarProps } from "@admin-components"
import { MagicAvatar } from "@admin-components"
import { AiModel } from "@admin/const/aiModel"

import officialIcon from "@admin/assets/logos/favicon.svg"
import openaiIcon from "@admin/assets/services/Openai.png"
import azureIcon from "@admin/assets/services/Azure.png"
import volcengineIcon from "@admin/assets/services/Volcengine.png"
import alibabacloudIcon from "@admin/assets/services/Alibabacloud.png"
import deepseekIcon from "@admin/assets/services/Deepseek.png"
import awsIcon from "@admin/assets/services/AWS.png"
import googleIcon from "@admin/assets/services/Google.png"
import openrouterIcon from "@admin/assets/services/Openrouter.png"
import miraclevisionIcon from "@admin/assets/services/Miraclevision2.png"
import defaultIcon from "@admin/assets/services/Default.png"
import ttapiIcon from "@admin/assets/services/TTapi.png"
import tencentCloudIcon from "@admin/assets/services/TencentCloud.png"
import baiduCloudIcon from "@admin/assets/services/BaiduCloud.png"
import moonshotIcon from "@admin/assets/services/KimiPlatform.png"
import miniMaxIcon from "@admin/assets/services/MiniMaxPlatform.png"
import scnetIcon from "@admin/assets/services/Scnet.png"
import siliconFlowIcon from "@admin/assets/services/SiliconFlow.png"
import bigModelIcon from "@admin/assets/services/BigModel.png"
import anthropicIcon from "@admin/assets/services/Anthropic.png"
import kelingIcon from "@admin/assets/services/Keling.png"

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
	[AiModel.ServiceProvider.Tencent]: tencentCloudIcon,
	[AiModel.ServiceProvider.TTAPI]: ttapiIcon,
	[AiModel.ServiceProvider.Baidu]: baiduCloudIcon,
	[AiModel.ServiceProvider.SCNet]: scnetIcon,
	[AiModel.ServiceProvider.SiliconFlow]: siliconFlowIcon,
	[AiModel.ServiceProvider.Moonshot]: moonshotIcon,
	[AiModel.ServiceProvider.MiniMax]: miniMaxIcon,
	[AiModel.ServiceProvider.BigModel]: bigModelIcon,
	[AiModel.ServiceProvider.Anthropic]: anthropicIcon,
	[AiModel.ServiceProvider.Keling]: kelingIcon,
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
