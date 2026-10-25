import officialIcon from "@magic-admin-v2/assets/logos/favicon.svg";
import awsIcon from "@magic-admin-v2/assets/services/AWS.png";
import alibabacloudIcon from "@magic-admin-v2/assets/services/Alibabacloud.png";
import anthropicIcon from "@magic-admin-v2/assets/services/Anthropic.png";
import azureIcon from "@magic-admin-v2/assets/services/Azure.png";
import baiduCloudIcon from "@magic-admin-v2/assets/services/BaiduCloud.png";
import bigModelIcon from "@magic-admin-v2/assets/services/BigModel.png";
import deepseekIcon from "@magic-admin-v2/assets/services/Deepseek.png";
import defaultProviderIcon from "@magic-admin-v2/assets/services/Default.png";
import googleIcon from "@magic-admin-v2/assets/services/Google.png";
import kelingIcon from "@magic-admin-v2/assets/services/Keling.png";
import moonshotIcon from "@magic-admin-v2/assets/services/KimiPlatform.png";
import miniMaxIcon from "@magic-admin-v2/assets/services/MiniMaxPlatform.png";
import miraclevisionIcon from "@magic-admin-v2/assets/services/Miraclevision2.png";
import openaiIcon from "@magic-admin-v2/assets/services/Openai.png";
import openrouterIcon from "@magic-admin-v2/assets/services/Openrouter.png";
import scnetIcon from "@magic-admin-v2/assets/services/Scnet.png";
import siliconFlowIcon from "@magic-admin-v2/assets/services/SiliconFlow.png";
import ttapiIcon from "@magic-admin-v2/assets/services/TTapi.png";
import tencentCloudIcon from "@magic-admin-v2/assets/services/TencentCloud.png";
import volcengineIcon from "@magic-admin-v2/assets/services/Volcengine.png";
import { providerType, type ProviderType } from "@magic-admin-v2/features/platform-provider-list/types";

const providerIconMap: Partial<Record<string, string>> = {
  Official: officialIcon,
  OpenAI: openaiIcon,
  MicrosoftAzure: azureIcon,
  Volcengine: volcengineIcon,
  VolcengineArk: volcengineIcon,
  MiracleVision: miraclevisionIcon,
  Tencent: tencentCloudIcon,
  Qwen: alibabacloudIcon,
  DashScope: alibabacloudIcon,
  QwenGlobal: alibabacloudIcon,
  TTAPI: ttapiIcon,
  DeepSeek: deepseekIcon,
  AWSBedrock: awsIcon,
  "Google-Image": googleIcon,
  Google: googleIcon,
  Gemini: googleIcon,
  OpenRouter: openrouterIcon,
  Baidu: baiduCloudIcon,
  SCNet: scnetIcon,
  Moonshot: moonshotIcon,
  SiliconFlow: siliconFlowIcon,
  BigModel: bigModelIcon,
  MiniMax: miniMaxIcon,
  Anthropic: anthropicIcon,
  Keling: kelingIcon,
};

export function getProviderLogoSrc({
  code,
  icon,
  type,
}: {
  code?: string;
  icon?: string;
  type?: ProviderType;
}) {
  if (type === providerType.custom) {
    return defaultProviderIcon;
  }

  if (code && providerIconMap[code]) {
    return providerIconMap[code];
  }

  return icon || defaultProviderIcon;
}

export { defaultProviderIcon };
