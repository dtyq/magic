<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Initializer;

use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
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
            $createdProviderCount = 0;
            $providers = self::getProviderData($officialOrgCode);
            foreach ($providers as $provider) {
                $exists = Db::table('service_provider')
                    ->where('provider_code', $provider['provider_code'])
                    ->where('category', $provider['category'])
                    ->whereNull('deleted_at')
                    ->exists();

                if ($exists) {
                    continue;
                }

                $provider['id'] = IdGenerator::getSnowId();
                Db::table('service_provider')->insert($provider);
                ++$createdProviderCount;
                ++$insertedCount;
            }

            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            return [
                'success' => false,
                'message' => 'Failed to initialize service providers: ' . $e->getMessage(),
                'count' => 0,
            ];
        }

        $message = "Successfully initialized {$insertedCount} items (providers: {$createdProviderCount}).";
        $message .= ' Official video providers must be initialized manually via /api/v1/bootstrap/video-providers.';

        return [
            'success' => true,
            'message' => $message,
            'count' => $insertedCount,
        ];
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
            // Magic Official - LLM
            [
                'name' => 'Magic',
                'provider_code' => ProviderCode::Official->value,
                'sort_order' => 999,
                'description' => '由 Magic 通过官方部署的 API 来实现 AI 模型的调用，可直接购买 Tokens 使用海量的大模型。',
                'icon' => 'MAGIC/588417216353927169/default/superMagic.png',
                'provider_type' => 1,
                'category' => 'llm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Magic',
                        'zh_CN' => 'Magic',
                    ],
                    'description' => [
                        'en_US' => 'Magic officially deploys these APIs to provide access to AI models. You can purchase Tokens directly to use a wide range of large models.',
                        'zh_CN' => '由 Magic 通过官方部署的 API 来实现 AI 模型的调用，可直接购买 Tokens 使用海量的大模型。',
                    ],
                ]),
                'remark' => '',
            ],
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
                'name' => 'Google',
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
                        'en_US' => 'Google',
                        'zh_CN' => 'Google',
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
            // DeepSeek - LLM
            [
                'name' => 'DeepSeek',
                'provider_code' => ProviderCode::DeepSeek->value,
                'sort_order' => 992,
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
            // Tencent Hunyuan - LLM
            [
                'name' => '腾讯云混元',
                'provider_code' => ProviderCode::Tencent->value,
                'sort_order' => 991,
                'description' => '腾讯云混元是腾讯云提供的大语言模型服务，支持中文理解、复杂推理、代码生成和多轮对话等场景。',
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
                        'en_US' => 'Tencent Hunyuan',
                        'zh_CN' => '腾讯云混元',
                    ],
                    'description' => [
                        'en_US' => 'Tencent Hunyuan is a large language model service provided by Tencent Cloud, supporting Chinese understanding, complex reasoning, code generation, and multi-turn conversation scenarios.',
                        'zh_CN' => '腾讯云混元是腾讯云提供的大语言模型服务，支持中文理解、复杂推理、代码生成和多轮对话等场景。',
                    ],
                ]),
                'remark' => '',
            ],
            // Baidu Qianfan - LLM
            [
                'name' => '百度千帆',
                'provider_code' => ProviderCode::Baidu->value,
                'sort_order' => 990,
                'description' => '百度千帆是百度智能云提供的大模型平台，支持文心系列及多种主流模型的企业级接入。',
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
                        'en_US' => 'Baidu Qianfan',
                        'zh_CN' => '百度千帆',
                    ],
                    'description' => [
                        'en_US' => 'Baidu Qianfan is a large model platform provided by Baidu AI Cloud, supporting enterprise access to ERNIE series and other mainstream models.',
                        'zh_CN' => '百度千帆是百度智能云提供的大模型平台，支持文心系列及多种主流模型的企业级接入。',
                    ],
                ]),
                'remark' => '',
            ],
            // National Supercomputing Platform - LLM
            [
                'name' => '国家超算平台',
                'provider_code' => ProviderCode::SCNet->value,
                'sort_order' => 989,
                'description' => '国家超算平台提供兼容 OpenAI 接口的大模型 API 服务，适合国产算力与模型能力接入场景。',
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
                        'en_US' => 'National Supercomputing Platform',
                        'zh_CN' => '国家超算平台',
                    ],
                    'description' => [
                        'en_US' => 'National Supercomputing Platform provides OpenAI-compatible large model API services for domestic computing power and model access scenarios.',
                        'zh_CN' => '国家超算平台提供兼容 OpenAI 接口的大模型 API 服务，适合国产算力与模型能力接入场景。',
                    ],
                ]),
                'remark' => '',
            ],
            // Kimi - LLM
            [
                'name' => 'Kimi',
                'provider_code' => ProviderCode::Moonshot->value,
                'sort_order' => 988,
                'description' => 'Kimi 是月之暗面提供的大模型服务，支持长上下文对话、复杂推理和代码生成等能力。',
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
                        'en_US' => 'Kimi',
                        'zh_CN' => 'Kimi',
                    ],
                    'description' => [
                        'en_US' => 'Kimi is a large model service provided by Moonshot AI, supporting long-context conversation, complex reasoning, and code generation.',
                        'zh_CN' => 'Kimi 是月之暗面提供的大模型服务，支持长上下文对话、复杂推理和代码生成等能力。',
                    ],
                ]),
                'remark' => '',
            ],
            // Zhipu AI - LLM
            [
                'name' => '智谱 AI',
                'provider_code' => ProviderCode::BigModel->value,
                'sort_order' => 987,
                'description' => '智谱 AI 提供 GLM 系列大模型服务，支持对话、推理、代码生成和 Agent 场景接入。',
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
                        'en_US' => 'Zhipu AI',
                        'zh_CN' => '智谱 AI',
                    ],
                    'description' => [
                        'en_US' => 'Zhipu AI provides GLM series large model services for chat, reasoning, code generation, and agent scenarios.',
                        'zh_CN' => '智谱 AI 提供 GLM 系列大模型服务，支持对话、推理、代码生成和 Agent 场景接入。',
                    ],
                ]),
                'remark' => '',
            ],
            // MiniMax - LLM
            [
                'name' => 'MiniMax',
                'provider_code' => ProviderCode::MiniMax->value,
                'sort_order' => 986,
                'description' => 'MiniMax 提供文本、语音和多模态大模型服务，支持通过兼容接口快速接入多类 AI 能力。',
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
                        'en_US' => 'MiniMax provides text, speech, and multimodal large model services, supporting quick access to multiple AI capabilities through compatible APIs.',
                        'zh_CN' => 'MiniMax 提供文本、语音和多模态大模型服务，支持通过兼容接口快速接入多类 AI 能力。',
                    ],
                ]),
                'remark' => '',
            ],
            // SiliconFlow - LLM
            [
                'name' => '硅基流动',
                'provider_code' => ProviderCode::SiliconFlow->value,
                'sort_order' => 985,
                'description' => '硅基流动提供兼容 OpenAI 接口的大模型服务，支持多种国产与开源模型的统一调用。',
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
                        'en_US' => 'SiliconFlow',
                        'zh_CN' => '硅基流动',
                    ],
                    'description' => [
                        'en_US' => 'SiliconFlow provides OpenAI-compatible large model services, supporting unified calls to domestic and open-source models.',
                        'zh_CN' => '硅基流动提供兼容 OpenAI 接口的大模型服务，支持多种国产与开源模型的统一调用。',
                    ],
                ]),
                'remark' => '',
            ],
            // Anthropic - LLM
            [
                'name' => 'Anthropic',
                'provider_code' => ProviderCode::Anthropic->value,
                'sort_order' => 993,
                'description' => 'Anthropic 提供 Claude 系列大语言模型，支持长上下文与多轮对话，适用于复杂推理与专业写作等场景。',
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
                        'en_US' => 'Anthropic',
                        'zh_CN' => 'Anthropic',
                    ],
                    'description' => [
                        'en_US' => 'Anthropic provides the Claude family of large language models with long context and multi-turn dialogue, suitable for complex reasoning and professional writing.',
                        'zh_CN' => 'Anthropic 提供 Claude 系列大语言模型，支持长上下文与多轮对话，适用于复杂推理与专业写作等场景。',
                    ],
                ]),
                'remark' => '',
            ],
            // Custom OpenAI - LLM
            [
                'name' => '自定义提供商',
                'provider_code' => ProviderCode::OpenAI->value,
                'sort_order' => 991,
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
            // Magic Official - VLM
            [
                'name' => 'Magic',
                'provider_code' => ProviderCode::Official->value,
                'sort_order' => 999,
                'description' => '由 Magic 通过官方部署的 API 来实现多种热门的文生图、图生图等模型的调用，可直接购买 Tokens 使用海量的大模型。',
                'icon' => 'MAGIC/588417216353927169/default/superMagic.png',
                'provider_type' => 1,
                'category' => 'vlm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Magic',
                        'zh_CN' => 'Magic',
                    ],
                    'description' => [
                        'en_US' => 'Magic officially deploys these APIs to provide access to popular text-to-image and image-to-image models. You can purchase Tokens directly to use a wide range of models.',
                        'zh_CN' => '由 Magic 通过官方部署的 API 来实现多种热门的文生图、图生图等模型的调用，可直接购买 Tokens 使用海量的大模型。',
                    ],
                ]),
                'remark' => '',
            ],
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
                'name' => 'Google',
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
                        'en_US' => 'Google',
                        'zh_CN' => 'Google',
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
            // ========== VGM 类别 ==========
            // Keling - VGM
            [
                'name' => '可灵',
                'provider_code' => ProviderCode::Keling->value,
                'sort_order' => 1000,
                'description' => '可灵提供视频生成模型服务，支持文生视频、图生视频等创意视频生成场景。',
                'icon' => 'MAGIC/713471849556451329/default/magic.png',
                'provider_type' => 0,
                'category' => 'vgm',
                'status' => 1,
                'is_models_enable' => 1,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Kling',
                        'zh_CN' => '可灵',
                    ],
                    'alias' => [
                        'en_US' => 'Kling',
                        'zh_CN' => '可灵',
                    ],
                    'description' => [
                        'en_US' => 'Kling provides video generation model services for creative text-to-video and image-to-video scenarios.',
                        'zh_CN' => '可灵提供视频生成模型服务，支持文生视频、图生视频等创意视频生成场景。',
                    ],
                ]),
                'remark' => '可灵',
            ],
            // Volcengine Ark - VGM
            [
                'name' => '火山引擎（方舟）',
                'provider_code' => ProviderCode::VolcengineArk->value,
                'sort_order' => 1000,
                'description' => '火山引擎方舟提供视频生成模型服务，支持文生视频、图生视频等视频创作场景。',
                'icon' => 'MAGIC/713471849556451329/default/magic.png',
                'provider_type' => 0,
                'category' => 'vgm',
                'status' => 1,
                'is_models_enable' => 1,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Volcengine Ark',
                        'zh_CN' => '火山引擎（方舟）',
                    ],
                    'alias' => [
                        'en_US' => 'Volcengine Ark',
                        'zh_CN' => '火山引擎（方舟）',
                    ],
                    'description' => [
                        'en_US' => 'Volcengine Ark provides video generation model services for text-to-video and image-to-video creation scenarios.',
                        'zh_CN' => '火山引擎方舟提供视频生成模型服务，支持文生视频、图生视频等视频创作场景。',
                    ],
                ]),
                'remark' => '聚合文生视频',
            ],
            // MiniMax - VGM
            [
                'name' => 'MiniMax',
                'provider_code' => ProviderCode::MiniMax->value,
                'sort_order' => 1000,
                'description' => 'MiniMax 提供视频生成模型服务，支持文生视频、首尾帧和多模态参考视频创作场景。',
                'icon' => 'MAGIC/713471849556451329/default/magic.png',
                'provider_type' => 0,
                'category' => 'vgm',
                'status' => 1,
                'is_models_enable' => 1,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'MiniMax',
                        'zh_CN' => 'MiniMax',
                    ],
                    'alias' => [
                        'en_US' => 'MiniMax',
                        'zh_CN' => 'MiniMax',
                    ],
                    'description' => [
                        'en_US' => 'MiniMax provides video generation model services for text-to-video, keyframe-guided, and multimodal reference creation scenarios.',
                        'zh_CN' => 'MiniMax 提供视频生成模型服务，支持文生视频、首尾帧和多模态参考视频创作场景。',
                    ],
                ]),
                'remark' => 'MiniMax',
            ],
            // DashScope - VGM
            [
                'name' => '阿里云(百炼)',
                'provider_code' => ProviderCode::DashScope->value,
                'sort_order' => 1000,
                'description' => '阿里云百炼提供 Wan 系列视频生成模型服务，支持文生视频、图生视频等创作场景。',
                'icon' => 'MAGIC/713471849556451329/default/magic.png',
                'provider_type' => 0,
                'category' => 'vgm',
                'status' => 1,
                'is_models_enable' => 1,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Aliyun (Bailian)',
                        'zh_CN' => '阿里云(百炼)',
                    ],
                    'alias' => [
                        'en_US' => 'Aliyun (Bailian)',
                        'zh_CN' => '阿里云(百炼)',
                    ],
                    'description' => [
                        'en_US' => 'Alibaba Cloud Bailian provides Wan video generation models for text-to-video and image-to-video creation scenarios.',
                        'zh_CN' => '阿里云百炼提供 Wan 系列视频生成模型服务，支持文生视频、图生视频等创作场景。',
                    ],
                ]),
                'remark' => 'Wan 视频生成',
            ],
            // Gemini - VGM
            [
                'name' => 'Google Gemini',
                'provider_code' => ProviderCode::Gemini->value,
                'sort_order' => 1000,
                'description' => 'Google Gemini 提供视频生成模型服务，支持文本和参考素材驱动的视频创作场景。',
                'icon' => 'MAGIC/713471849556451329/default/default.png',
                'provider_type' => 0,
                'category' => 'vgm',
                'status' => 1,
                'is_models_enable' => 1,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Google Gemini',
                        'zh_CN' => 'Google Gemini',
                    ],
                    'alias' => [
                        'en_US' => 'Google Gemini',
                        'zh_CN' => 'Google Gemini',
                    ],
                    'description' => [
                        'en_US' => 'Google Gemini provides video generation model services for text and reference-material-driven video creation scenarios.',
                        'zh_CN' => 'Google Gemini 提供视频生成模型服务，支持文本和参考素材驱动的视频创作场景。',
                    ],
                ]),
                'remark' => 'Gemini 视频生成',
            ],
        ];
    }
}
