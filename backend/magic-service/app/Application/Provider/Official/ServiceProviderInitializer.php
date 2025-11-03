<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Official;

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
        // Check if service_provider table already has data
        $existingCount = Db::table('service_provider')->count();
        if ($existingCount > 0) {
            return [
                'success' => true,
                'message' => "Service provider table already has {$existingCount} records, skipping initialization.",
                'count' => 0,
            ];
        }

        // Get official organization code from config
        $officialOrgCode = config('service_provider.office_organization', '');
        if (empty($officialOrgCode)) {
            return [
                'success' => false,
                'message' => 'Official organization code not configured in service_provider.office_organization',
                'count' => 0,
            ];
        }

        $providers = self::getProviderData($officialOrgCode);
        $insertedCount = 0;

        try {
            Db::beginTransaction();

            foreach ($providers as $provider) {
                Db::table('service_provider')->insert($provider);
                ++$insertedCount;
            }

            Db::commit();

            return [
                'success' => true,
                'message' => "Successfully initialized {$insertedCount} service providers.",
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
     * Get service provider data.
     * @param string $orgCode Official organization code
     */
    private static function getProviderData(string $orgCode): array
    {
        $now = now();

        return [
            // Magic - LLM (Official)
            [
                'id' => '759103339540475904',
                'name' => 'Magic',
                'provider_code' => 'Official',
                'description' => '由 Magic 通过官方部署的 API 来实现 AI 模型的调用，可直接购买积分使用海量的大模型。',
                'icon' => 'MAGIC/713471849556451329/default/magic.png',
                'provider_type' => 1, // Official
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
                        'en_US' => 'The AI model invocation is achieved through the API officially deployed by Magic, and you can directly purchase points to use a vast number of large models.',
                        'zh_CN' => '由 Magic 通过官方部署的 API 来实现 AI 模型的调用，可直接购买积分使用海量的大模型。',
                    ],
                ]),
                'remark' => '',
            ],
            // Microsoft Azure - LLM
            [
                'id' => '759109912413282304',
                'name' => 'Microsoft Azure',
                'provider_code' => 'MicrosoftAzure',
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
                        'zh_CN' => '微软 Azure',
                    ],
                    'description' => [
                        'en_US' => 'Azure provides a variety of advanced AI models, including GPT-3.5 and the latest GPT-4 series, supporting multiple data types and complex tasks, committed to safe, reliable and sustainable AI solutions.',
                        'zh_CN' => 'Azure 提供多种先进的AI模型、包括GPT-3.5和最新的GPT-4系列、支持多种数据类型和复杂任务，致力于安全、可靠和可持续的AI解决方案,',
                    ],
                ]),
                'remark' => '',
            ],
            // Volcengine - LLM
            [
                'id' => '759110465734258688',
                'name' => '火山引擎',
                'provider_code' => 'Volcengine',
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
                        'en_US' => 'ByteDance',
                        'zh_CN' => '字节跳动',
                    ],
                    'description' => [
                        'en_US' => 'A cloud service platform under ByteDance, with independently developed Doubao large model series. Includes Doubao general models Pro and lite with different text processing and comprehensive capabilities, as well as various models for role-playing, speech synthesis, etc.',
                        'zh_CN' => '字节跳动旗下的云服务平台，有自主研发的豆包大模型系列。涵盖豆包通用模型 Pro、lite，具备不同文本处理和综合能力，还有角色扮演、语音合成等多种模型。',
                    ],
                ]),
                'remark' => '',
            ],
            // Volcengine - VLM
            [
                'id' => '759115881155366912',
                'name' => '火山引擎',
                'provider_code' => 'Volcengine',
                'description' => '提供多种智能绘图大模型，生图风格多样，安全性极高，可亠泛应用干教育、娱乐、办公等场量。',
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
                        'en_US' => 'Volcengine',
                        'zh_CN' => '火山引擎',
                    ],
                    'description' => [
                        'en_US' => 'Provides a variety of intelligent drawing models, with diverse image generation styles, extremely high security, and can be widely applied to education, entertainment, office and other scenarios.',
                        'zh_CN' => '提供多种智能绘图大模型，生图风格多样，安全性极高，可亠泛应用干教育、娱乐、办公等场量。',
                    ],
                ]),
                'remark' => '',
            ],
            // MiracleVision - VLM
            [
                'id' => '759116798252494849',
                'name' => '美图奇想',
                'provider_code' => 'MiracleVision',
                'description' => '专注于人脸技术、人体技术、图像识别、图像处理、图像生成等核心领域',
                'icon' => 'MAGIC/713471849556451329/default/meitu-qixiang Avatars.png',
                'provider_type' => 0,
                'category' => 'vlm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'MiracleVision',
                        'zh_CN' => '美图奇想',
                    ],
                    'description' => [
                        'en_US' => 'Focused on facial technology, body technology, image recognition, image processing, image generation and other core areas',
                        'zh_CN' => '专注于人脸技术、人体技术、图像识别、图像处理、图像生成等核心领域',
                    ],
                ]),
                'remark' => '',
            ],
            // Magic - VLM (Official)
            [
                'id' => '759144726407426049',
                'name' => 'Magic',
                'provider_code' => 'Official',
                'description' => '由 Magic 通过官方部署的 API 来实现多种热门的文生图、图生图等模型的调用，可直接购买积分使用海量的大模型。',
                'icon' => 'MAGIC/713471849556451329/default/magic.png',
                'provider_type' => 1, // Official
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
                        'en_US' => 'Magic implements the invocation of various popular models such as text-to-image and image-to-image through the officially deployed API. You can directly purchase points to use a vast number of large models.',
                        'zh_CN' => '由 Magic 通过官方部署的 API 来实现多种热门的文生图、图生图等模型的调用，可直接购买积分使用海量的大模型。',
                    ],
                ]),
                'remark' => '',
            ],
            // TTAPI.io - VLM
            [
                'id' => '759145734546132992',
                'name' => 'TTAPI.io',
                'provider_code' => 'TTAPI',
                'description' => '整合多平台文生图、文生视频能力，Midjourney API、DALL·E 3、Luma文生视频、Flux API服务等等。',
                'icon' => 'MAGIC/713471849556451329/default/TTAPI.io Avatars.png',
                'provider_type' => 0,
                'category' => 'vlm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'TTAPI.io',
                        'zh_CN' => 'TTAPI.io',
                    ],
                    'description' => [
                        'en_US' => 'Integrates multi-platform text-to-image, text-to-video capabilities, Midjourney API, DALL·E 3, Luma text-to-video, Flux API service, etc.',
                        'zh_CN' => '整合多平台文生图、文生视频能力，Midjourney API、DALL·E 3、Luma文生视频、Flux API服务等等。',
                    ],
                ]),
                'remark' => '',
            ],
            // Custom OpenAI - LLM
            [
                'id' => '764067503220973568',
                'name' => '自定义服务商',
                'provider_code' => 'OpenAI',
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
                        'en_US' => 'Custom service provider',
                        'zh_CN' => '自定义服务商',
                    ],
                    'description' => [
                        'en_US' => 'Use a service provider with the same form of interface as the OpenAI API',
                        'zh_CN' => '请使用接口与 OpenAI API 相同形式的服务商',
                    ],
                ]),
                'remark' => '支持 OpenAI API 形式',
            ],
            // Amazon Bedrock - LLM
            [
                'id' => '771078297613344768',
                'name' => 'Amazon Bedrock',
                'provider_code' => 'AWSBedrock',
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
            // Microsoft Azure - VLM
            [
                'id' => '792047422971920384',
                'name' => 'Microsoft Azure',
                'provider_code' => 'MicrosoftAzure',
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
            // Qwen - VLM
            [
                'id' => '792047422971920385',
                'name' => 'Qwen',
                'provider_code' => 'Qwen',
                'description' => '提供通用图像生成模型，支持多种艺术风格，尤其擅长复杂文本渲染，特别是中英文文本渲染。',
                'icon' => 'MAGIC/713471849556451329/default/qwen Avatars White.png',
                'provider_type' => 0,
                'category' => 'vlm',
                'status' => 1,
                'is_models_enable' => 0,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode([
                    'name' => [
                        'en_US' => 'Qwen',
                        'zh_CN' => '阿里云百炼',
                    ],
                    'description' => [
                        'en_US' => 'It provides a universal image generation model, supports multiple artistic styles, and is particularly skilled at complex text rendering, especially in both Chinese and English text rendering.',
                        'zh_CN' => '提供通用图像生成模型，支持多种艺术风格，尤其擅长复杂文本渲染，特别是中英文文本渲染。',
                    ],
                ]),
                'remark' => '',
            ],
            // Google Cloud - VLM
            [
                'id' => '792047422971920386',
                'name' => 'Google Cloud',
                'provider_code' => 'Google-Image',
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
                        'en_US' => 'Google Cloud',
                        'zh_CN' => 'Google Cloud',
                    ],
                    'description' => [
                        'en_US' => 'Gemini 2.5 Flash Image (Nano Banana) image generation model is provided, featuring high character consistency and precise image editing, etc.',
                        'zh_CN' => '提供 Gemini 2.5 Flash Image (Nano Banana) 图像生成模型，具备角色一致性高、精准图像编辑等。',
                    ],
                ]),
                'remark' => '',
            ],
            // VolcengineArk - VLM
            [
                'id' => '792047422971920387',
                'name' => 'VolcengineArk',
                'provider_code' => 'VolcengineArk',
                'description' => '火山引擎方舟',
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
                        'en_US' => 'VolcengineArk',
                        'zh_CN' => '火山引擎（方舟）',
                    ],
                    'description' => [
                        'en_US' => '',
                        'zh_CN' => '',
                    ],
                ]),
                'remark' => '',
            ],
        ];
    }
}
