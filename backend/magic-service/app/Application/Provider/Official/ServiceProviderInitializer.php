<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Official;

use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use Hyperf\DbConnection\Db;
use Throwable;

use function Hyperf\Support\now;

/**
 * Official Service Provider Initializer.
 * Initialize default service providers for new system setup.
 */
class ServiceProviderInitializer
{
    /**
     * Initialize official service providers.
     * @return array{success: bool, message: string, count: int}
     */
    public static function init(): array
    {
        // Get official organization code from config
        $officialOrgCode = config('service_provider.office_organization', '');
        if (empty($officialOrgCode)) {
            return [
                'success' => false,
                'message' => 'Official organization code not configured in service_provider.office_organization',
                'count' => 0,
            ];
        }

        $insertedCount = 0;

        try {
            Db::beginTransaction();

            // Step 1: Initialize service_provider table (provider definitions)
            $existingProviderCount = Db::table('service_provider')->count();
            if ($existingProviderCount === 0) {
                $providers = self::getProviderData($officialOrgCode);
                foreach ($providers as $provider) {
                    Db::table('service_provider')->insert($provider);
                    ++$insertedCount;
                }
            }

            // Step 2: Initialize service_provider_configs table (organization-specific configurations)
            // Ensure the official organization has an enabled provider config
            $configCount = self::initializeProviderConfigs($officialOrgCode);
            $insertedCount += $configCount;

            Db::commit();

            $message = $existingProviderCount > 0
                ? "Service provider table already has {$existingProviderCount} records. Configs initialized: {$configCount}."
                : "Successfully initialized {$insertedCount} items (providers + configs).";

            return [
                'success' => true,
                'message' => $message,
                'count' => $insertedCount,
            ];
        } catch (Throwable $e) {
            Db::rollBack();
            return [
                'success' => false,
                'message' => 'Failed to initialize service providers: ' . $e->getMessage(),
                'count' => 0,
            ];
        }
    }

    /**
     * Initialize service provider configurations for the organization.
     * Ensures that the official provider config exists and is enabled.
     * @param string $orgCode Organization code
     * @return int Number of configs created or updated
     */
    private static function initializeProviderConfigs(string $orgCode): int
    {
        $count = 0;
        $now = now();

        // Step 1: Get the official LLM provider ID from service_provider table
        $officialProvider = Db::table('service_provider')
            ->where('provider_type', 1) // Official provider type
            ->where('category', 'llm')
            ->first();

        if (! $officialProvider) {
            // No official provider found, skip config initialization
            return 0;
        }

        $providerData = is_object($officialProvider) ? $officialProvider : (object) $officialProvider;
        $officialProviderId = $providerData->id;

        // Step 2: Check if config exists for this organization and official provider
        $existingConfig = Db::table('service_provider_configs')
            ->where('organization_code', $orgCode)
            ->where('service_provider_id', $officialProviderId)
            ->first();

        if ($existingConfig) {
            // Config exists, ensure it's enabled
            $configData = is_object($existingConfig) ? $existingConfig : (object) $existingConfig;
            if ($configData->status != 1) {
                Db::table('service_provider_configs')
                    ->where('id', $configData->id)
                    ->update(['status' => 1, 'updated_at' => $now]);
                ++$count;
            }
        } else {
            // Config doesn't exist, create a new one with enabled status
            Db::table('service_provider_configs')->insert([
                'organization_code' => $orgCode,
                'service_provider_id' => $officialProviderId,
                'alias' => 'Magic Official',
                'translate' => json_encode([
                    'alias' => [
                        'en_US' => 'Magic Official',
                        'zh_CN' => 'Magic 官方',
                    ],
                ]),
                'config' => json_encode([]),
                'status' => 1, // Enabled
                'sort' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            ++$count;
        }

        return $count;
    }

    /**
     * Get service provider data.
     * @param string $orgCode Official organization code
     */
    private static function getProviderData(string $orgCode): array
    {
        $now = now();

        return [
            // ========== LLM 类别 ==========
            // Microsoft Azure - LLM
            [
                'name' => 'Microsoft Azure',
                'provider_code' => ProviderCode::MicrosoftAzure->value,
                'sort_order' => 998,
                'description' => 'Azure 提供多种先进的AI模型、包括GPT-3.5和最新的GPT-4系列、支持多种数据类型和复杂任务，致力于安全、可靠和可持续的AI解决方案,',
                'icon' => 'MAGIC/713471849556451329/default/azure Avatars.png',
                'provider_type' => 0, // Normal
                'category' => 'llm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Microsoft Azure',
                        'zh_CN' => 'Microsoft Azure',
                    ],
                    'description' => [
                        'en_US' => 'Azure provides a variety of advanced AI models, including GPT-3.5 and the latest GPT-4 series, supporting multiple data types and complex tasks, committed to safe, reliable and sustainable AI solutions.',
                        'zh_CN' => 'Azure 提供多种先进的AI模型、包括GPT-3.5和最新的GPT-4系列、支持多种数据类型和复杂任务，致力于安全、可靠和可持续的AI解决方案,',
                    ],
                ]),
                'remark' => '',
            ],
            // Gemini - LLM
            [
                'name' => 'Google (AI Studio)',
                'provider_code' => ProviderCode::Gemini->value,
                'sort_order' => 997,
                'description' => 'Google Gemini 是 Google 开发的多模态 AI 模型，支持文本、图像等多种输入。',
                'icon' => 'MAGIC/713471849556451329/default/default.png',
                'provider_type' => 0,
                'category' => 'llm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Google (AI Studio)',
                        'zh_CN' => 'Google (AI Studio)',
                    ],
                    'description' => [
                        'en_US' => 'Google Gemini is a multimodal AI model developed by Google, supporting various inputs such as text and images.',
                        'zh_CN' => 'Google Gemini 是 Google 开发的多模态 AI 模型，支持文本、图像等多种输入。',
                    ],
                ]),
                'remark' => '',
            ],
            // Amazon Bedrock - LLM
            [
                'name' => 'Amazon Bedrock',
                'provider_code' => ProviderCode::AWSBedrock->value,
                'sort_order' => 996,
                'description' => 'Amazon Bedrock 是亚马逊 AWS 提供的一项服务，专注于为企业提供先进的 AI 语言模型和视觉模型。其模型家族包括 Anthropic 的 Claude 系列、Meta 的 Llama 3.1 系列等，涵盖从轻量级到高性能的多种选择，支持文本生成、对话、图像处理等多种任务，适用于不同规模和需求的企业应用。',
                'icon' => 'MAGIC/713471849556451329/default/awsAvatars.png',
                'provider_type' => 0,
                'category' => 'llm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Amazon Bedrock',
                        'zh_CN' => 'Amazon Bedrock',
                    ],
                    'description' => [
                        'en_US' => "Amazon Bedrock is a service offered by Amazon AWS that focuses on advanced AI language models and visual models for businesses. Its model family, including Anthropic's Claude series and Meta's Llama 3.1 series, covers a variety of options from lightweight to high-performance, supporting a variety of tasks such as text generation, dialogue, image processing, and suitable for enterprise applications of different sizes and needs.",
                        'zh_CN' => 'Amazon Bedrock 是亚马逊 AWS 提供的一项服务，专注于为企业提供先进的 AI 语言模型和视觉模型。其模型家族包括 Anthropic 的 Claude 系列、Meta 的 Llama 3.1 系列等，涵盖从轻量级到高性能的多种选择，支持文本生成、对话、图像处理等多种任务，适用于不同规模和需求的企业应用。',
                    ],
                ]),
                'remark' => '',
            ],
            // OpenRouter - LLM & Image
            [
                'name' => 'OpenRouter',
                'provider_code' => ProviderCode::OpenRouter->value,
                'sort_order' => 995,
                'description' => 'OpenRouter 是一个统一的大模型聚合平台，提供标准化的 OpenAI 兼容接口。通过对接 OpenRouter，可以一次性集成 GPT-4、Claude 3、Gemini、Llama 3 以及 Flux 等主流模型，无需为每个厂商单独开发。支持文本生成、对话、图像生成等多种任务，适用于不同规模和需求的企业应用。',
                'icon' => 'MAGIC/713471849556451329/default/default.png',
                'provider_type' => 0,
                'category' => 'llm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'OpenRouter',
                        'zh_CN' => 'OpenRouter',
                    ],
                    'description' => [
                        'en_US' => 'OpenRouter is a unified large model aggregation platform that provides standardized OpenAI-compatible interfaces. By integrating with OpenRouter, you can integrate mainstream models such as GPT-4, Claude 3, Gemini, Llama 3, and Flux at once, without the need to develop separately for each vendor. It supports various tasks such as text generation, dialogue, and image generation, suitable for enterprise applications of different scales and needs.',
                        'zh_CN' => 'OpenRouter 是一个统一的大模型聚合平台，提供标准化的 OpenAI 兼容接口。通过对接 OpenRouter，可以一次性集成 GPT-4、Claude 3、Gemini、Llama 3 以及 Flux 等主流模型，无需为每个厂商单独开发。支持文本生成、对话、图像生成等多种任务，适用于不同规模和需求的企业应用。',
                    ],
                ]),
                'remark' => '',
            ],
            // DashScope - LLM (Aliyun Bailian)
            [
                'name' => '阿里云(百炼)',
                'provider_code' => ProviderCode::DashScope->value,
                'sort_order' => 994,
                'description' => '阿里云百炼（DashScope）是阿里云提供的一站式大模型服务平台，提供通义千问系列模型服务。平台支持文本生成、对话交互、图像生成、语音合成等多种 AI 能力，涵盖从通用对话到专业领域的多种应用场景，适用于企业级 AI 应用开发和部署。',
                'icon' => 'MAGIC/713471849556451329/default/default.png',
                'provider_type' => 0,
                'category' => 'llm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Aliyun (Bailian)',
                        'zh_CN' => '阿里云(百炼)',
                    ],
                    'description' => [
                        'en_US' => 'Alibaba Cloud Bailian (DashScope) is a one-stop large model service platform provided by Alibaba Cloud, offering Tongyi Qianwen series model services. The platform supports various AI capabilities such as text generation, dialogue interaction, image generation, and speech synthesis, covering a wide range of application scenarios from general conversation to professional domains, suitable for enterprise-level AI application development and deployment.',
                        'zh_CN' => '阿里云百炼（DashScope）是阿里云提供的一站式大模型服务平台，提供通义千问系列模型服务。平台支持文本生成、对话交互、图像生成、语音合成等多种 AI 能力，涵盖从通用对话到专业领域的多种应用场景，适用于企业级 AI 应用开发和部署。',
                    ],
                ]),
                'remark' => '',
            ],
            // Volcengine - LLM
            [
                'name' => '火山引擎',
                'provider_code' => ProviderCode::Volcengine->value,
                'sort_order' => 993,
                'description' => '字节跳动旗下的云服务平台，有自主研发的豆包大模型系列。涵盖豆包通用模型 Pro、lite，具备不同文本处理和综合能力，还有角色扮演、语音合成等多种模型。',
                'icon' => 'MAGIC/713471849556451329/default/volcengine Avatars.png',
                'provider_type' => 0,
                'category' => 'llm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Volcengine',
                        'zh_CN' => '火山引擎',
                    ],
                    'description' => [
                        'en_US' => 'A cloud service platform under ByteDance, with independently developed Doubao large model series. Includes Doubao general models Pro and lite with different text processing and comprehensive capabilities, as well as various models for role-playing, speech synthesis, etc.',
                        'zh_CN' => '字节跳动旗下的云服务平台，有自主研发的豆包大模型系列。涵盖豆包通用模型 Pro、lite，具备不同文本处理和综合能力，还有角色扮演、语音合成等多种模型。',
                    ],
                ]),
                'remark' => '',
            ],
            // MiniMax - LLM
            [
                'name' => 'MiniMax',
                'provider_code' => ProviderCode::MiniMax->value,
                'sort_order' => 992,
                'description' => 'MiniMax 是一家领先的 AI 大模型公司，提供高性能的 MiniMax-M2.7 和 MiniMax-M2.5 系列模型，支持百万级超长上下文、工具调用和深度思考能力，通过 OpenAI 兼容接口提供服务。',
                'icon' => 'MAGIC/713471849556451329/default/default.png',
                'provider_type' => 0,
                'category' => 'llm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'MiniMax',
                        'zh_CN' => 'MiniMax',
                    ],
                    'description' => [
                        'en_US' => 'MiniMax is a leading AI large model company, providing high-performance MiniMax-M2.7 and MiniMax-M2.5 series models with million-token context, tool calling and deep thinking capabilities, served via an OpenAI-compatible API.',
                        'zh_CN' => 'MiniMax 是一家领先的 AI 大模型公司，提供高性能的 MiniMax-M2.7 和 MiniMax-M2.5 系列模型，支持百万级超长上下文、工具调用和深度思考能力，通过 OpenAI 兼容接口提供服务。',
                    ],
                ]),
                'remark' => '',
            ],
            // DeepSeek - LLM
            [
                'name' => 'DeepSeek',
                'provider_code' => ProviderCode::DeepSeek->value,
                'sort_order' => 991,
                'description' => 'DeepSeek 是一家专注于 AI 大模型的公司，提供高性能的 AI 语言模型服务。',
                'icon' => 'MAGIC/713471849556451329/default/default.png',
                'provider_type' => 0,
                'category' => 'llm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'DeepSeek',
                        'zh_CN' => 'DeepSeek',
                    ],
                    'description' => [
                        'en_US' => 'DeepSeek is a company focused on AI large models, providing high-performance AI language model services.',
                        'zh_CN' => 'DeepSeek 是一家专注于 AI 大模型的公司，提供高性能的 AI 语言模型服务。',
                    ],
                ]),
                'remark' => '',
            ],
            // Custom OpenAI - LLM
            [
                'name' => '自定义提供商',
                'provider_code' => ProviderCode::OpenAI->value,
                'sort_order' => 990,
                'description' => '请使用接口与 OpenAI API 相同形式的服务商',
                'icon' => 'MAGIC/713471849556451329/default/默认图标.png',
                'provider_type' => 0,
                'category' => 'llm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Custom Provider',
                        'zh_CN' => '自定义提供商',
                    ],
                    'description' => [
                        'en_US' => 'Use a service provider with the same form of interface as the OpenAI API',
                        'zh_CN' => '请使用接口与 OpenAI API 相同形式的服务商',
                    ],
                ]),
                'remark' => '支持 OpenAI API 形式',
            ],
            // ========== VLM 类别 ==========
            // Microsoft Azure - VLM
            [
                'name' => 'Microsoft Azure',
                'provider_code' => ProviderCode::MicrosoftAzure->value,
                'sort_order' => 998,
                'description' => '提供多种先进的AI模型、包括GPT-3.5和最新的GPT-4系列、支持多种数据类型和复杂任务，致力于安全、可靠和可持续的AI解决方案。',
                'icon' => 'MAGIC/713471849556451329/default/azure Avatars.png',
                'provider_type' => 0,
                'category' => 'vlm',
                'status' => 1,
                'is_models_enable' => 1,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Microsoft Azure',
                        'zh_CN' => 'Microsoft Azure',
                    ],
                    'description' => [
                        'en_US' => 'Azure offers a variety of advanced AI models, including GPT-3.5 and the latest GPT-4 series, supporting multiple data types and complex tasks, and is committed to providing safe, reliable and sustainable AI solutions.',
                        'zh_CN' => 'Azure 提供多种先进的AI模型，包括GPT-3.5和最新的GPT-4系列，支持多种数据类型和复杂任务，致力于安全、可靠和可持续的AI解决方案。',
                    ],
                ]),
                'remark' => '',
            ],
            // Google Cloud - VLM
            [
                'name' => 'Google (AI Studio)',
                'provider_code' => ProviderCode::Google->value,
                'sort_order' => 997,
                'description' => '提供 Gemini 2.5 Flash Image (Nano Banana) 图像生成模型，具备角色一致性高、精准图像编辑等。',
                'icon' => $orgCode . '/713471849556451329/2c17c6393771ee3048ae34d6b380c5ec/Q-2terxwePTElOJ_ONtrw.png',
                'provider_type' => 0,
                'category' => 'vlm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Google (AI Studio)',
                        'zh_CN' => 'Google (AI Studio)',
                    ],
                    'description' => [
                        'en_US' => 'Gemini 2.5 Flash Image (Nano Banana) image generation model is provided, featuring high character consistency and precise image editing, etc.',
                        'zh_CN' => '提供 Gemini 2.5 Flash Image (Nano Banana) 图像生成模型，具备角色一致性高、精准图像编辑等。',
                    ],
                ]),
                'remark' => '',
            ],
            // OpenRouter - Image
            [
                'name' => 'OpenRouter',
                'provider_code' => ProviderCode::OpenRouter->value,
                'sort_order' => 995,
                'description' => 'OpenRouter 是一个统一的大模型聚合平台，提供标准化的 OpenAI 兼容接口。通过对接 OpenRouter，可以一次性集成 GPT-4、Claude 3、Gemini、Llama 3 以及 Flux 等主流模型，无需为每个厂商单独开发。支持文本生成、对话、图像生成等多种任务，适用于不同规模和需求的企业应用。',
                'icon' => 'MAGIC/713471849556451329/default/default.png',
                'provider_type' => 0,
                'category' => 'vlm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'OpenRouter',
                        'zh_CN' => 'OpenRouter',
                    ],
                    'description' => [
                        'en_US' => 'OpenRouter is a unified large model aggregation platform that provides standardized OpenAI-compatible interfaces. By integrating with OpenRouter, you can integrate mainstream models such as GPT-4, Claude 3, Gemini, Llama 3, and Flux at once, without the need to develop separately for each vendor. It supports various tasks such as text generation, dialogue, and image generation, suitable for enterprise applications of different scales and needs.',
                        'zh_CN' => 'OpenRouter 是一个统一的大模型聚合平台，提供标准化的 OpenAI 兼容接口。通过对接 OpenRouter，可以一次性集成 GPT-4、Claude 3、Gemini、Llama 3 以及 Flux 等主流模型，无需为每个厂商单独开发。支持文本生成、对话、图像生成等多种任务，适用于不同规模和需求的企业应用。',
                    ],
                ]),
                'remark' => '',
            ],
            // DashScope - VLM (Aliyun Bailian)
            [
                'name' => '阿里云(百炼)',
                'provider_code' => ProviderCode::Qwen->value,
                'sort_order' => 994,
                'description' => '阿里云百炼（DashScope）是阿里云提供的一站式大模型服务平台，提供通义千问系列模型服务。平台支持文本生成、对话交互、图像生成、语音合成等多种 AI 能力，涵盖从通用对话到专业领域的多种应用场景，适用于企业级 AI 应用开发和部署。',
                'icon' => 'MAGIC/713471849556451329/default/default.png',
                'provider_type' => 0,
                'category' => 'vlm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Aliyun (Bailian)',
                        'zh_CN' => '阿里云(百炼)',
                    ],
                    'description' => [
                        'en_US' => 'Alibaba Cloud Bailian (DashScope) is a one-stop large model service platform provided by Alibaba Cloud, offering Tongyi Qianwen series model services. The platform supports various AI capabilities such as text generation, dialogue interaction, image generation, and speech synthesis, covering a wide range of application scenarios from general conversation to professional domains, suitable for enterprise-level AI application development and deployment.',
                        'zh_CN' => '阿里云百炼（DashScope）是阿里云提供的一站式大模型服务平台，提供通义千问系列模型服务。平台支持文本生成、对话交互、图像生成、语音合成等多种 AI 能力，涵盖从通用对话到专业领域的多种应用场景，适用于企业级 AI 应用开发和部署。',
                    ],
                ]),
                'remark' => '',
            ],
            // Volcengine - VLM
            [
                'name' => 'VolcengineArk',
                'provider_code' => ProviderCode::VolcengineArk->value,
                'sort_order' => 993,
                'description' => '火山引擎方舟（Volcengine Ark）是字节跳动火山引擎提供的 AI 图像生成服务。平台提供高质量的文生图和图生图能力，支持多张参考图像输入、组图生成、图像编辑等高级功能，适用于内容创作、设计辅助、营销素材生成等多种应用场景。',
                'icon' => 'MAGIC/713471849556451329/default/volcengine Avatars.png',
                'provider_type' => 0,
                'category' => 'vlm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Volcengine Ark',
                        'zh_CN' => '火山引擎（方舟）',
                    ],
                    'description' => [
                        'en_US' => 'Volcengine Ark is an AI image generation service provided by ByteDance Volcengine. The platform offers high-quality text-to-image and image-to-image capabilities, supporting advanced features such as multiple reference image input, sequential image generation, and image editing, suitable for various application scenarios such as content creation, design assistance, and marketing material generation.',
                        'zh_CN' => '火山引擎方舟（Volcengine Ark）是字节跳动火山引擎提供的 AI 图像生成服务。平台提供高质量的文生图和图生图能力，支持多张参考图像输入、组图生成、图像编辑等高级功能，适用于内容创作、设计辅助、营销素材生成等多种应用场景。',
                    ],
                ]),
                'remark' => '',
            ],
        ];
    }
}
