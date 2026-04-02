<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

use App\Domain\Provider\DTO\Item\AbstractProviderConfigItem;
use App\Domain\Provider\DTO\Item\GoogleProviderConfigItem;
use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use Hyperf\Odin\Model\AwsBedrockModel;
use Hyperf\Odin\Model\AzureOpenAIModel;
use Hyperf\Odin\Model\DashScopeModel;
use Hyperf\Odin\Model\DeepSeekModel;
use Hyperf\Odin\Model\DoubaoModel;
use Hyperf\Odin\Model\GeminiModel;
use Hyperf\Odin\Model\OpenAIModel;

enum ProviderCode: string
{
    case None = 'None';
    case Official = 'Official'; // 官方
    case Volcengine = 'Volcengine'; // 火山
    case OpenAI = 'OpenAI';
    case MicrosoftAzure = 'MicrosoftAzure';
    case Qwen = 'Qwen';
    case DeepSeek = 'DeepSeek';
    case Tencent = 'Tencent';
    case TTAPI = 'TTAPI';
    case MiracleVision = 'MiracleVision';
    case AWSBedrock = 'AWSBedrock';
    case Google = 'Google-Image';
    case VolcengineArk = 'VolcengineArk';
    case Gemini = 'Gemini';
    case DashScope = 'DashScope';
    case OpenRouter = 'OpenRouter';
    case SuChuang = 'SuChuang';
    case MiniMax = 'MiniMax';

    public function getImplementation(): string
    {
        return match ($this) {
            self::MicrosoftAzure => AzureOpenAIModel::class,
            self::Volcengine => DoubaoModel::class,
            self::AWSBedrock => AwsBedrockModel::class,
            self::Gemini => GeminiModel::class,
            self::DeepSeek => DeepSeekModel::class,
            self::DashScope => DashScopeModel::class,
            self::OpenRouter => OpenAIModel::class,
            self::MiniMax => OpenAIModel::class,
            default => OpenAIModel::class,
        };
    }

    public function getImplementationConfig(AbstractProviderConfigItem $config, string $name = ''): array
    {
        $config->setUrl($this->getModelUrl($config));

        switch (get_class($config)) {
            case ProviderConfigItem::class:
                return match ($this) {
                    self::MicrosoftAzure => [
                        'api_key' => $config->getApiKey(),
                        'api_base' => $config->getUrl(),
                        'api_version' => $config->getApiVersion(),
                        'deployment_name' => $name,
                    ],
                    self::AWSBedrock => [
                        'access_key' => $config->getAk(),
                        'secret_key' => $config->getSk(),
                        'region' => $config->getRegion(),
                        'auto_cache' => config('llm.aws_bedrock_auto_cache', true),
                    ],
                    default => [
                        'api_key' => $config->getApiKey(),
                        'base_url' => $config->getUrl(),
                        'auto_cache' => config('llm.openai_auto_cache', true),
                        'auto_cache_config' => [
                            'auto_enabled' => config('llm.openai_auto_cache', true),
                        ],
                    ]
                };
            case GoogleProviderConfigItem::class:
                return [
                    'api_key' => $config->getApiKey(),
                    'base_url' => $config->getUrl(),
                    'auto_cache_config' => [
                        'enable_cache' => config('llm.gemini_auto_cache', true),
                    ],
                    'service_account' => $config->toOdinServiceAccountConfig(),
                ];
            default:
                return [
                    'api_key' => $config->getApiKey(),
                    'base_url' => $config->getUrl(),
                    'auto_cache' => config('llm.openai_auto_cache', true),
                    'auto_cache_config' => [
                        'auto_enabled' => config('llm.openai_auto_cache', true),
                    ],
                ];
        }
    }

    public function isOfficial(): bool
    {
        return $this === self::Official;
    }

    /**
     * 获取服务商的排序顺序（用于非官方服务商列表展示）.
     * 按照指定顺序：Microsoft Azure -> Google -> Amazon Bedrock -> OpenRouter -> Aliyun -> Volcengine -> DeepSeek -> Custom Provider.
     *
     * @return int 排序值，值越小越靠前
     */
    public function getSortOrder(): int
    {
        return match ($this) {
            self::MicrosoftAzure => 1,
            self::Google, self::Gemini => 2,
            self::AWSBedrock => 3,
            self::TTAPI => 4,
            self::DashScope => 5,
            self::OpenRouter => 6,
            self::Volcengine, self::VolcengineArk => 7,
            self::DeepSeek => 8,
            self::MiniMax => 9,
            default => 999, // 其他服务商排在最后
        };
    }

    private function getModelUrl(AbstractProviderConfigItem $config): string
    {
        return $config->getUrl() ?? '';
    }
}
