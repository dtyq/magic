<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelAdmin\Command;

use App\Application\ModelAdmin\Service\ServiceProviderAppService;
use App\Domain\File\Repository\Persistence\CloudFileRepository;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelAdmin\Constant\ModelType;
use App\Domain\ModelAdmin\Constant\ServiceProviderCategory;
use App\Domain\ModelAdmin\Constant\ServiceProviderCode;
use App\Domain\ModelAdmin\Constant\ServiceProviderType;
use App\Domain\ModelAdmin\Constant\Status;
use App\Domain\ModelAdmin\Entity\ServiceProviderEntity;
use App\Domain\ModelAdmin\Entity\ServiceProviderModelsEntity;
use App\Domain\ModelAdmin\Entity\ValueObject\ModelConfig;
use App\Domain\ModelAdmin\Repository\Persistence\ServiceProviderConfigRepository;
use App\Domain\ModelAdmin\Repository\Persistence\ServiceProviderModelsRepository;
use App\Domain\ModelAdmin\Repository\Persistence\ServiceProviderRepository;
use App\Domain\ModelAdmin\Service\ServiceProviderDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Exception;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Psr\Container\ContainerInterface;

/**
 * @Command
 */
#[Command]
class InitServiceProviderCommand extends HyperfCommand
{
    /**
     * 命令描述.
     */
    protected string $description = '初始化服务商数据，支持大模型服务商和文生图服务商';

    protected ServiceProviderRepository $serviceProviderRepository;

    protected ServiceProviderConfigRepository $serviceProviderConfigRepository;

    protected ServiceProviderModelsRepository $serviceProviderModelsRepository;

    protected ServiceProviderDomainService $serviceProviderDomainService;

    protected ServiceProviderAppService $serviceProviderAppService;

    protected ContainerInterface $container;

    #[Inject]
    protected FileDomainService $fileDomainService;

    /**
     * 图标上传缓存.
     */
    protected array $iconCache = [];

    /**
     * 预设的服务商数据. 会同步给其他组织.
     */
    protected array $presetServiceProviders = [[
        'name' => 'Magic',
        'description' => '由 Magic 通过官方部署的 API 来实现 API 模型的调用，可直接购买 Tokens 使用海量的大模型。',
        'icon' => 'superMagic.png',
        'icon_dir' => 'magic',
        'provider_type' => ServiceProviderType::OFFICIAL->value,
        'category' => ServiceProviderCategory::LLM->value,
        'status' => Status::ACTIVE->value,
        'translate' => [
            'name' => [
                'en_US' => 'Magic',
                'zh_CN' => 'Magic',
            ],
            'description' => [
                'en_US' => 'Officially deployed by Magic via AP! To achieve A! Model call, you can directly buy Tokens using a massive large model.',
                'zh_CN' => '由 Magic 通过官方部署的 AP! 来实现 A! 模型的调用，可直接购买 Tokens 使用海量的大模型。',
            ],
        ],
        'provider_code' => ServiceProviderCode::Magic->value,
    ]];

    /**
     * 预设的服务商协议. 不会同步给其他组织.
     */
    protected array $presetServiceProvidersProtocol = [
        [
            'name' => '自定义服务商 ',
            'description' => '请使用接口与 OpenAI API 相同形式的服务商',
            'icon' => 'default.png',
            'icon_dir' => 'service_provider',
            'provider_type' => ServiceProviderType::CUSTOM->value,
            'category' => ServiceProviderCategory::LLM->value,
            'status' => Status::ACTIVE->value,
            'translate' => [
                'name' => [
                    'en_US' => 'Custom service provider',
                    'zh_CN' => '自定义服务商',
                ],
                'description' => [
                    'en_US' => 'Use a service provider with the same form of interface as the OpenAI API',
                    'zh_CN' => '请使用接口与 OpenAI API 相同形式的服务商',
                ],
            ],
            'provider_code' => ServiceProviderCode::OpenAI->value,
        ],
        [
            'name' => 'Microsoft Azure',
            'description' => 'Azure 提供多种先进的AI模型、包括GPT-3.5和最新的GPT-4系列、支持多种数据类型和复杂任务，致力于安全、可靠和可持续的AI解决方案,',
            'icon' => 'AzureOpenaiAvatars.png',
            'icon_dir' => 'service_provider',
            'provider_type' => ServiceProviderType::NORMAL->value,
            'category' => ServiceProviderCategory::LLM->value,
            'status' => 0,
            'translate' => [
                'name' => [
                    'en_US' => 'Microsoft Azure',
                    'zh_CN' => '微软 Azure',
                ],
                'description' => [
                    'en_US' => 'Azure provides a variety of advanced AI models, including GPT-3.5 and the latest GPT-4 series, supporting multiple data types and complex tasks, committed to safe, reliable and sustainable AI solutions.',
                    'zh_CN' => 'Azure 提供多种先进的AI模型、包括GPT-3.5和最新的GPT-4系列、支持多种数据类型和复杂任务，致力于安全、可靠和可持续的AI解决方案,',
                ],
            ],
            'models' => [],
            'provider_code' => ServiceProviderCode::MicrosoftAzure->value,
        ],
        [
            'name' => '字节跳动',
            'description' => '字节跳动旗下的云服务平台，有自主研发的豆包大模型系列。涵盖豆包通用模型 Pro、lite，具备不同文本处理和综合能力，还有角色扮演、语音合成等多种模型。',
            'icon' => 'doubaoAvatarsWhite.png',
            'icon_dir' => 'service_provider',
            'provider_type' => ServiceProviderType::NORMAL->value,
            'category' => ServiceProviderCategory::LLM->value,
            'status' => Status::ACTIVE->value,
            'translate' => [
                'name' => [
                    'en_US' => 'ByteDance',
                    'zh_CN' => '字节跳动',
                ],
                'description' => [
                    'en_US' => 'A cloud service platform under ByteDance, with independently developed Doubao large model series. Includes Doubao general models Pro and lite with different text processing and comprehensive capabilities, as well as various models for role-playing, speech synthesis, etc.',
                    'zh_CN' => '字节跳动旗下的云服务平台，有自主研发的豆包大模型系列。涵盖豆包通用模型 Pro、lite，具备不同文本处理和综合能力，还有角色扮演、语音合成等多种模型。',
                ],
            ],
            'provider_code' => ServiceProviderCode::Volcengine->value,
        ],
    ];

    /**
     * 预设的文生图服务商数据.
     */
    protected array $presetVLMServiceProviders = [
        [
            'name' => 'Magic',
            'description' => '由 Magic 通过官方部署的 AP! 来实现多种热门的文生图、图生图等模型的调用，可直接购买 Tokens 使用海量的大模型。',
            'icon' => 'superMagic.png',
            'icon_dir' => 'magic',
            'provider_type' => ServiceProviderType::OFFICIAL->value,
            'category' => ServiceProviderCategory::VLM->value,
            'status' => Status::ACTIVE->value,
            'translate' => [
                'name' => [
                    'en_US' => 'Magic',
                    'zh_CN' => 'Magic',
                ],
                'description' => [
                    'en_US' => 'Through the official deployment of AP! by Magic to achieve various popular text-to-image and image-to-image model calls, you can directly purchase Tokens to use massive models.',
                    'zh_CN' => '由 Magic 通过官方部署的 AP! 来实现多种热门的文生图、图生图等模型的调用，可直接购买 Tokens 使用海量的大模型。',
                ],
            ],
            'provider_code' => ServiceProviderCode::Magic->value,
            'config' => [
                'ak' => '',
                'sk' => '',
                'api_key' => '',
                'url' => '',
                'proxy_url' => '',
                'api_version' => '',
                'deployment_name' => '',
            ],
            'models' => [
                [
                    'model_id' => 'Midjourney-turbo',
                    'name' => 'Midjourney-turbo',
                    'model_version' => 'turbo',
                    'description' => '',
                    'icon' => 'midjourneyAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'Midjourney-turbo',
                            'zh_CN' => 'Midjourney-turbo',
                        ],
                    ],
                ],
                [
                    'model_id' => 'Midjourney-relax',
                    'name' => 'Midjourney-relax',
                    'model_version' => 'relax',
                    'description' => '',
                    'icon' => 'midjourneyAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'Midjourney-relax',
                            'zh_CN' => 'Midjourney-relax',
                        ],
                    ],
                ],
                [
                    'model_id' => 'Midjourney-fast',
                    'name' => 'Midjourney-fast',
                    'model_version' => 'fast',
                    'description' => '',
                    'icon' => 'midjourneyAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'Midjourney-fast',
                            'zh_CN' => 'Midjourney-fast',
                        ],
                    ],
                ],
                [
                    'model_id' => 'miracleVision_mtlab',
                    'name' => '图片AI超清',
                    'model_version' => 'mtlab',
                    'description' => '',
                    'icon' => 'meituQixiangAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::IMAGE_ENHANCE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'AI Image Enhancement',
                            'zh_CN' => '图片AI超清',
                        ],
                    ],
                ],
                [
                    'model_id' => 'flux1-pro',
                    'name' => 'flux1-pro',
                    'model_version' => 'flux1-pro',
                    'description' => '',
                    'icon' => 'fluxAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'flux1-pro',
                            'zh_CN' => 'flux1-pro',
                        ],
                    ],
                ],
                [
                    'model_id' => 'flux1-dev',
                    'name' => 'flux1-dev',
                    'model_version' => 'flux1-dev',
                    'description' => '',
                    'icon' => 'fluxAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'flux1-dev',
                            'zh_CN' => 'flux1-dev',
                        ],
                    ],
                ],
                [
                    'model_id' => 'flux1-schnell',
                    'name' => 'flux1-schnell',
                    'model_version' => 'flux1-schnell',
                    'description' => '',
                    'icon' => 'fluxAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'flux1-schnell',
                            'zh_CN' => 'flux1-schnell',
                        ],
                    ],
                ],
                [
                    'model_id' => 'Volcengine_high_aes_general_v21_L',
                    'name' => '通用2.1模型(文生图)',
                    'model_version' => 'high_aes_general_v21_L',
                    'description' => '',
                    'icon' => 'volcengineAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'General 2.1 Model (Text-to-Image)',
                            'zh_CN' => '通用2.1模型(文生图)',
                        ],
                    ],
                ],
                [
                    'model_id' => 'Volcengine_byteedit_v2.0.0',
                    'name' => '图片AI超清',
                    'model_version' => 'byteedit_v2.0',
                    'description' => '',
                    'icon' => 'volcengineAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::IMAGE_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'AI Image Enhancement',
                            'zh_CN' => '图片AI超清',
                        ],
                    ],
                ],
                [
                    'model_id' => 'TTAPI-GPT4o',
                    'name' => 'gpt4o文生图',
                    'icon' => 'openaiAvatars.png',
                    'icon_dir' => 'service_provider',
                    'model_version' => 'TTAPI-GPT4o',
                    'description' => 'gtp4o文生图，贼牛逼',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'Convert Text To Picture',
                            'zh_CN' => 'gpt4o文生图',
                        ],
                    ],
                ],
            ],
        ],
        [
            'name' => '美图奇想',
            'description' => '专注于人脸技术、人体技术、图像识别、图像处理、图像生成等核心领域',
            'icon' => 'meituQixiangAvatars.png',
            'icon_dir' => 'magic',
            'provider_type' => ServiceProviderType::NORMAL->value,
            'category' => ServiceProviderCategory::VLM->value,
            'status' => 0,
            'translate' => [
                'name' => [
                    'en_US' => 'MiracleVision',
                    'zh_CN' => '美图奇想',
                ],
                'description' => [
                    'en_US' => 'Focused on facial technology, body technology, image recognition, image processing, image generation and other core areas',
                    'zh_CN' => '专注于人脸技术、人体技术、图像识别、图像处理、图像生成等核心领域',
                ],
            ],
            'provider_code' => ServiceProviderCode::MiracleVision->value,
            'config' => [
                'ak' => '',
                'sk' => '',
                'api_key' => '',
                'url' => '',
                'proxy_url' => '',
                'api_version' => '',
                'deployment_name' => '',
            ],
            'models' => [
                [
                    'model_id' => 'miracleVision_mtlab',
                    'name' => '图片AI超清',
                    'model_version' => 'mtlab',
                    'description' => '',
                    'icon' => 'meituQixiangAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::IMAGE_ENHANCE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'AI Image Enhancement',
                            'zh_CN' => '图片AI超清',
                        ],
                    ],
                ],
            ],
        ],
        [
            'name' => 'TTAPI.io',
            'description' => '整合多平台文生图、文生视频能力，Midjourney API、DALL·E 3、Luma文生视频、Flux API服务等等。',
            'icon' => 'TTAPIAvatars.png',
            'icon_dir' => 'magic',
            'provider_type' => ServiceProviderType::NORMAL->value,
            'category' => ServiceProviderCategory::VLM->value,
            'status' => 0,
            'translate' => [
                'name' => [
                    'en_US' => 'TTAPI.io',
                    'zh_CN' => 'TTAPI.io',
                ],
                'description' => [
                    'en_US' => 'Integrates multi-platform text-to-image, text-to-video capabilities, Midjourney API, DALL·E 3, Luma text-to-video, Flux API service, etc.',
                    'zh_CN' => '整合多平台文生图、文生视频能力，Midjourney API、DALL·E 3、Luma文生视频、Flux API服务等等。',
                ],
            ],
            'provider_code' => ServiceProviderCode::TTAPI->value,
            'config' => [
                'ak' => '',
                'sk' => '',
                'api_key' => '',
                'url' => '',
                'proxy_url' => '',
                'api_version' => '',
                'deployment_name' => '',
            ],
            'models' => [
                [
                    'model_id' => 'TTAPI-GPT4o',
                    'name' => 'gpt4o文生图',
                    'model_version' => 'TTAPI-GPT4o',
                    'description' => 'gtp4o文生图，贼牛逼',
                    'icon' => 'openaiAvatars.png',
                    'icon_dir' => 'service_provider',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'Convert Text To Picture',
                            'zh_CN' => 'gpt4o文生图',
                        ],
                    ],
                ],
                [
                    'model_id' => 'flux1-schnell',
                    'name' => 'flux1-schnell',
                    'model_version' => 'flux1-schnell',
                    'description' => '',
                    'icon' => 'fluxAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'flux1-schnell',
                            'zh_CN' => 'flux1-schnell',
                        ],
                    ],
                ],
                [
                    'model_id' => 'flux1-dev',
                    'name' => 'flux1-dev',
                    'model_version' => 'flux1-dev',
                    'description' => '',
                    'icon' => 'fluxAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'flux1-dev',
                            'zh_CN' => 'flux1-dev',
                        ],
                    ],
                ],
                [
                    'model_id' => 'flux1-pro',
                    'name' => 'flux1-pro',
                    'model_version' => 'flux1-pro',
                    'description' => '',
                    'icon' => 'fluxAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'flux1-pro',
                            'zh_CN' => 'flux1-pro',
                        ],
                    ],
                ],
                [
                    'model_id' => 'Midjourney-turbo',
                    'name' => 'Midjourney-turbo',
                    'model_version' => 'turbo',
                    'description' => '',
                    'icon' => 'midjourneyAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'Midjourney-turbo',
                            'zh_CN' => 'Midjourney-turbo',
                        ],
                    ],
                ],
                [
                    'model_id' => 'Midjourney-relax',
                    'name' => 'Midjourney-relax',
                    'model_version' => 'relax',
                    'description' => '',
                    'icon' => 'midjourneyAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'Midjourney-relax',
                            'zh_CN' => 'Midjourney-relax',
                        ],
                    ],
                ],
                [
                    'model_id' => 'Midjourney-fast',
                    'name' => 'Midjourney-fast',
                    'model_version' => 'fast',
                    'description' => '',
                    'icon' => 'midjourneyAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'Midjourney-fast',
                            'zh_CN' => 'Midjourney-fast',
                        ],
                    ],
                ],
            ],
        ],
        [
            'name' => '火山引擎',
            'description' => '提供多种智能绘图大模型，生图风格多样，安全性极高，可亠泛应用干教育、娱乐、办公等场量。',
            'icon' => 'volcengineAvatars.png',
            'icon_dir' => 'magic',
            'provider_type' => ServiceProviderType::NORMAL->value,
            'category' => ServiceProviderCategory::VLM->value,
            'status' => Status::ACTIVE->value,
            'translate' => [
                'name' => [
                    'en_US' => 'Volcengine',
                    'zh_CN' => '火山引擎',
                ],
                'description' => [
                    'en_US' => 'Provides a variety of intelligent drawing models, with diverse image generation styles, extremely high security, and can be widely applied to education, entertainment, office and other scenarios.',
                    'zh_CN' => '提供多种智能绘图大模型，生图风格多样，安全性极高，可亠泛应用干教育、娱乐、办公等场量。',
                ],
            ],
            'provider_code' => ServiceProviderCode::Volcengine->value,
            'config' => [
                'ak' => '',
                'sk' => '',
                'api_key' => '',
                'url' => '',
                'proxy_url' => '',
                'api_version' => '',
                'deployment_name' => '',
            ],
            'models' => [
                [
                    'model_id' => 'Volcengine_high_aes_general_v21_L',
                    'name' => '通用2.1模型(文生图)',
                    'model_version' => 'high_aes_general_v21_L',
                    'description' => '',
                    'icon' => 'volcengineAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::TEXT_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'General 2.1 Model (Text-to-Image)',
                            'zh_CN' => '通用2.1模型(文生图)',
                        ],
                    ],
                ],
                [
                    'model_id' => 'Volcengine_byteedit_v2.0.0',
                    'name' => '通用2.0 Pro-指令编辑(SeedEdit)',
                    'model_version' => 'byteedit_v2.0',
                    'description' => '',
                    'icon' => 'volcengineAvatars.png',
                    'icon_dir' => 'magic',
                    'model_type' => ModelType::IMAGE_TO_IMAGE->value,
                    'category' => 'vlm',
                    'config' => [
                        'max_tokens' => null,
                        'support_function' => false,
                        'support_deep_think' => false,
                        'vector_size' => 1000,
                        'support_multi_modal' => false,
                        'support_embedding' => false,
                    ],
                    'status' => Status::ACTIVE->value,
                    'sort' => 1,
                    'translate' => [
                        'name' => [
                            'en_US' => 'General 2.0 Pro-Instruction Editing (SeedEdit)',
                            'zh_CN' => '通用2.0 Pro-指令编辑(SeedEdit)',
                        ],
                    ],
                ],
            ],
        ],
    ];

    /**
     * 构造函数，注入依赖.
     */
    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
        $this->serviceProviderRepository = $container->get(ServiceProviderRepository::class);
        $this->serviceProviderConfigRepository = $container->get(ServiceProviderConfigRepository::class);
        $this->serviceProviderModelsRepository = $container->get(ServiceProviderModelsRepository::class);
        $this->serviceProviderDomainService = $container->get(ServiceProviderDomainService::class);
        $this->serviceProviderAppService = $container->get(ServiceProviderAppService::class);

        parent::__construct('service_provider:load');
    }

    public function initVLMServiceProviderModels()
    {
        $this->line('开始初始化文生图服务商的模型...', 'info');

        // 获取所有文生图服务商
        $serviceProviders = $this->serviceProviderRepository->getAllByCategory(1, 100, ServiceProviderCategory::VLM);

        foreach ($serviceProviders as $serviceProvider) {
            // 获取服务商的配置
            $configs = $this->serviceProviderConfigRepository->getsByServiceProviderId($serviceProvider->getId());
            $serviceProviderCode = ServiceProviderCode::from($serviceProvider->getProviderCode());

            if ($serviceProviderCode === ServiceProviderCode::Magic) {
                foreach ($configs as $config) {
                    // 从文生图服务商中获取模型
                    foreach ($this->presetVLMServiceProviders as $provider) {
                        if ($provider['provider_code'] === $serviceProviderCode->value) {
                            // 初始化模型
                            $this->initModels($provider['models'], $config->getId(), $config->getOrganizationCode());
                        }
                    }
                }
            }
            if ($serviceProviderCode === ServiceProviderCode::TTAPI) {
                foreach ($configs as $config) {
                    // 从文生图服务商中获取模型
                    foreach ($this->presetVLMServiceProviders as $provider) {
                        if ($provider['provider_code'] === $serviceProviderCode->value) {
                            // 初始化模型
                            $this->initModels($provider['models'], $config->getId(), $config->getOrganizationCode());
                        }
                    }
                }
            }
            if ($serviceProviderCode === ServiceProviderCode::Volcengine) {
                foreach ($configs as $config) {
                    // 从文生图服务商中获取模型
                    foreach ($this->presetVLMServiceProviders as $provider) {
                        if ($provider['provider_code'] === $serviceProviderCode->value) {
                            // 初始化模型
                            $this->initModels($provider['models'], $config->getId(), $config->getOrganizationCode());
                        }
                    }
                }
            }
            if ($serviceProviderCode === ServiceProviderCode::MiracleVision) {
                foreach ($configs as $config) {
                    // 从文生图服务商中获取模型
                    foreach ($this->presetVLMServiceProviders as $provider) {
                        if ($provider['provider_code'] === $serviceProviderCode->value) {
                            // 初始化模型
                            $this->initModels($provider['models'], $config->getId(), $config->getOrganizationCode());
                        }
                    }
                }
            }
        }
    }

    /**
     * 命令处理方法.
     */
    public function handle()
    {
        $this->line('开始初始化服务商...', 'info');

        Db::beginTransaction();
        try {
            $this->initLLMServiceProvider();
            $this->initVLMServiceProvider();
            $this->initLLMServiceProviderProtocol();
            // 初始化文生图服务商的模型
            $this->initVLMServiceProviderModels();
        } catch (Exception $exception) {
            Db::rollBack();
            throw $exception;
        }
        Db::commit();
    }

    /**
     * 上传图标文件.
     *
     * @param string $iconName 图标文件名
     * @param string $businessType 业务类型目录
     * @return string 上传后的文件key
     * @throws Exception
     */
    protected function uploadIcon(string $iconName, string $businessType): string
    {
        // 缓存key，避免本地重复操作
        $cacheKey = $businessType . '_' . $iconName;
        if (isset($this->iconCache[$cacheKey])) {
            return $this->iconCache[$cacheKey];
        }

        // 构建文件路径 - 使用新的文件结构
        $filePath = BASE_PATH . '/storage/files/MAGIC/open/default/' . $businessType . '/' . $iconName;

        // 如果新路径下文件不存在，尝试旧路径
        if (! file_exists($filePath)) {
            $filePath = BASE_PATH . '/storage/default_file/' . $businessType . '/' . $iconName;

            // 如果旧路径也不存在，报错
            if (! file_exists($filePath)) {
                $this->line('图标文件不存在: ' . $filePath, 'warning');
                return '';
            }
        }

        try {
            // 使用默认组织代码
            $organizationCode = CloudFileRepository::DEFAULT_ICON_ORGANIZATION_CODE;

            // 构建文件的相对路径作为 key
            $uploadDir = 'open/default/' . $businessType;
            $key = $organizationCode . '/' . $uploadDir . '/' . $iconName;

            // 创建上传文件对象
            $uploadFile = new UploadFile($filePath, $uploadDir, $iconName, false);

            // 1. 无条件上传文件到当前配置的云存储 - 确保文件在当前云存储中存在
            $this->fileDomainService->uploadByCredential($organizationCode, $uploadFile, StorageBucketType::Public, false);
            $this->line('成功上传图标文件到云存储: ' . $iconName, 'info');

            // 2. 检查数据库中是否有对应记录 - 对于已有记录，不需要重新插入数据库
            // 注意：这里不检查数据库，由调用方处理，不影响文件上传和key返回

            // 缓存key，避免重复操作
            $this->iconCache[$cacheKey] = $key;

            return $key;
        } catch (Exception $e) {
            $this->line('上传图标文件失败: ' . $e->getMessage(), 'error');
            return '';
        }
    }

    protected function initLLMServiceProvider()
    {
        $this->line('开始初始化大模型服务商...', 'info');

        foreach ($this->presetServiceProviders as $provider) {
            try {
                $serviceProviderEntity = new ServiceProviderEntity();
                $serviceProviderEntity->setName($provider['name']);
                $serviceProviderEntity->setDescription($provider['description']);

                // 上传并设置图标
                if (! empty($provider['icon']) && ! empty($provider['icon_dir'])) {
                    $iconKey = $this->uploadIcon($provider['icon'], $provider['icon_dir']);
                    $serviceProviderEntity->setIcon($iconKey);
                }

                $serviceProviderEntity->setProviderType($provider['provider_type']);
                $serviceProviderEntity->setCategory($provider['category']);
                $serviceProviderEntity->setStatus($provider['status']);
                $serviceProviderEntity->setTranslate($provider['translate']);
                $serviceProviderEntity->setProviderCode($provider['provider_code']);

                // 使用AppService添加服务商，自动同步到所有组织
                $this->line('正在添加大模型服务商: ' . $provider['name'], 'info');
                $this->serviceProviderAppService->addServiceProvider($serviceProviderEntity);
                $this->line('大模型服务商 ' . $provider['name'] . ' 添加成功', 'info');
            } catch (Exception $e) {
                $this->line('添加大模型服务商 ' . $provider['name'] . ' 失败: ' . $e->getMessage(), 'error');
            }
        }

        $this->line('大模型服务商初始化完成', 'info');
    }

    protected function initVLMServiceProvider()
    {
        $this->line('开始初始化文生图服务商...', 'info');

        foreach ($this->presetVLMServiceProviders as $provider) {
            try {
                // 创建服务商实体
                $serviceProviderEntity = new ServiceProviderEntity();
                $serviceProviderEntity->setName($provider['name']);
                $serviceProviderEntity->setDescription($provider['description']);

                // 上传并设置图标
                if (! empty($provider['icon']) && ! empty($provider['icon_dir'])) {
                    $iconKey = $this->uploadIcon($provider['icon'], $provider['icon_dir']);
                    $serviceProviderEntity->setIcon($iconKey);
                }

                $serviceProviderEntity->setProviderType($provider['provider_type']);
                $serviceProviderEntity->setCategory($provider['category']);
                $serviceProviderEntity->setStatus($provider['status']);
                $serviceProviderEntity->setTranslate($provider['translate']);
                $serviceProviderEntity->setProviderCode($provider['provider_code']);

                // 使用AppService添加服务商，自动同步到所有组织
                $this->line('正在添加文生图服务商: ' . $provider['name'], 'info');
                $this->serviceProviderAppService->addServiceProvider($serviceProviderEntity);
                $this->line('文生图服务商 ' . $provider['name'] . ' 添加成功', 'info');
            } catch (Exception $e) {
                $this->line('添加文生图服务商 ' . $provider['name'] . ' 失败: ' . $e->getMessage(), 'error');
            }
        }

        $this->line('文生图服务商初始化完成', 'info');
    }

    /**
     * 初始化模型数据.
     *
     * @param array $models 模型数据
     * @param int $configId 服务商配置ID
     * @param string $organizationCode 组织代码
     */
    protected function initModels(array $models, int $configId, string $organizationCode): void
    {
        if (empty($models)) {
            return;
        }

        $this->line('开始初始化模型，数量: ' . count($models), 'info');
        $modelEntities = [];

        foreach ($models as $model) {
            try {
                $modelEntity = new ServiceProviderModelsEntity();
                $modelEntity->setServiceProviderConfigId($configId);
                $modelEntity->setModelId($model['model_id']);
                $modelEntity->setName($model['name']);
                $modelEntity->setModelVersion($model['model_version']);
                $modelEntity->setDescription($model['description'] ?? '');

                // 上传并设置图标
                if (! empty($model['icon']) && ! empty($model['icon_dir'])) {
                    $iconKey = $this->uploadIcon($model['icon'], $model['icon_dir']);
                    $modelEntity->setIcon($iconKey);
                }

                $modelEntity->setModelType($model['model_type']);
                $modelEntity->setCategory($model['category']);
                $modelEntity->setStatus($model['status']);
                $modelEntity->setSort($model['sort'] ?? 1);
                $modelEntity->setTranslate($model['translate'] ?? []);
                $modelEntity->setOrganizationCode($organizationCode);

                // 设置模型配置
                if (! empty($model['config'])) {
                    $modelConfig = new ModelConfig();
                    $modelConfig->setMaxTokens($model['config']['max_tokens'] ?? null);
                    $modelConfig->setSupportFunction($model['config']['support_function'] ?? false);
                    $modelConfig->setSupportDeepThink($model['config']['support_deep_think'] ?? false);
                    $modelConfig->setVectorSize($model['config']['vector_size'] ?? 1000);
                    $modelConfig->setSupportMultiModal($model['config']['support_multi_modal'] ?? false);
                    $modelConfig->setSupportEmbedding($model['config']['support_embedding'] ?? false);
                    $modelEntity->setConfig($modelConfig);
                }

                $modelEntities[] = $modelEntity;
                $this->line('准备模型: ' . $model['name'], 'info');
            } catch (Exception $e) {
                $this->line('准备模型 ' . ($model['name'] ?? '') . ' 失败: ' . $e->getMessage(), 'error');
            }
        }

        // 批量插入模型
        if (! empty($modelEntities)) {
            try {
                $this->serviceProviderModelsRepository->batchInsert($modelEntities);
                $this->line('成功初始化 ' . count($modelEntities) . ' 个模型', 'info');
            } catch (Exception $e) {
                $this->line('批量添加模型失败: ' . $e->getMessage(), 'error');
            }
        }
    }

    private function initLLMServiceProviderProtocol()
    {
        $this->line('开始初始化大模型服务商...', 'info');

        foreach ($this->presetServiceProvidersProtocol as $provider) {
            try {
                $serviceProviderEntity = new ServiceProviderEntity();
                $serviceProviderEntity->setName($provider['name']);
                $serviceProviderEntity->setDescription($provider['description']);

                // 上传并设置图标
                if (! empty($provider['icon']) && ! empty($provider['icon_dir'])) {
                    $iconKey = $this->uploadIcon($provider['icon'], $provider['icon_dir']);
                    $serviceProviderEntity->setIcon($iconKey);
                }

                $serviceProviderEntity->setProviderType($provider['provider_type']);
                $serviceProviderEntity->setCategory($provider['category']);
                $serviceProviderEntity->setStatus($provider['status']);
                $serviceProviderEntity->setTranslate($provider['translate']);
                $serviceProviderEntity->setProviderCode($provider['provider_code']);

                // 使用AppService添加服务商，自动同步到所有组织
                $this->line('正在添加大模型服务商: ' . $provider['name'], 'info');
                $this->serviceProviderRepository->insert($serviceProviderEntity);

                $this->line('大模型服务商 ' . $provider['name'] . ' 添加成功', 'info');
            } catch (Exception $e) {
                $this->line('添加大模型服务商 ' . $provider['name'] . ' 失败: ' . $e->getMessage(), 'error');
            }
        }

        $this->line('大模型服务商初始化完成', 'info');
    }
}
