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
    case Baidu = 'Baidu';
    case SCNet = 'SCNet';
    case Moonshot = 'Moonshot';
    case BigModel = 'BigModel';
    case MiniMax = 'MiniMax';
    case SiliconFlow = 'SiliconFlow';
    case TTAPI = 'TTAPI';
    case MiracleVision = 'MiracleVision';
    case AWSBedrock = 'AWSBedrock';
    case Google = 'Google-Image';
    case VolcengineArk = 'VolcengineArk';
    case Gemini = 'Gemini';
    case DashScope = 'DashScope';
    case OpenRouter = 'OpenRouter';
    case SuChuang = 'SuChuang';

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
     * 判断当前服务商是否属于非官方组织的文本模型模板白名单。
     */
    public function isNonOfficialOrganizationLlmWhitelist(): bool
    {
        return match ($this) {
            self::DashScope,
            self::Volcengine,
            self::DeepSeek,
            self::Tencent,
            self::Baidu,
            self::SCNet,
            self::Moonshot,
            self::BigModel,
            self::MiniMax,
            self::SiliconFlow => true,
            default => false,
        };
    }

    /**
     * 判断当前服务商是否属于非官方组织模板白名单。
     */
    public function isNonOfficialOrganizationTemplateWhitelist(Category $category): bool
    {
        return match ($category) {
            Category::LLM => $this->isNonOfficialOrganizationLlmWhitelist(),
            Category::VLM => match ($this) {
                self::Qwen, self::VolcengineArk, self::TTAPI, self::MiracleVision, self::Volcengine => true,
                default => false,
            },
            default => false,
        };
    }

    /**
     * 获取服务商推荐接入地址。
     */
    public function getDefaultUrl(): string
    {
        return match ($this) {
            self::DashScope => 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            self::Volcengine => 'https://ark.cn-beijing.volces.com/api/v3',
            self::DeepSeek => 'https://api.deepseek.com',
            self::Tencent => 'https://api.hunyuan.cloud.tencent.com/v1',
            self::Baidu => 'https://qianfan.baidubce.com/v2',
            self::SCNet => 'https://api.scnet.cn/api/llm/v1',
            self::Moonshot => 'https://api.moonshot.cn/v1',
            self::BigModel => 'https://open.bigmodel.cn/api/paas/v4',
            self::MiniMax => 'https://api.minimaxi.com/v1',
            self::SiliconFlow => 'https://api.siliconflow.cn/v1',
            default => '',
        };
    }

    /**
     * 获取服务商允许的一级域名后缀。
     *
     * 非官方组织下，用户填写的 URL 只要命中这些一级域名即可通过校验。
     */
    public function getAllowedPrimaryDomains(): array
    {
        return match ($this) {
            self::DashScope, self::Qwen => ['aliyuncs.com'],
            self::Volcengine, self::VolcengineArk => ['volces.com'],
            self::DeepSeek => ['deepseek.com'],
            self::Tencent => ['tencent.com'],
            self::Baidu => ['baidubce.com'],
            self::SCNet => ['scnet.cn'],
            self::Moonshot => ['moonshot.cn'],
            self::BigModel => ['bigmodel.cn'],
            self::MiniMax => ['minimaxi.com'],
            self::SiliconFlow => ['siliconflow.cn'],
            default => [],
        };
    }

    /**
     * 判断服务商配置的 URL 是否命中了允许的一级域名。
     */
    public function isAllowedPrimaryDomainUrl(string $url): bool
    {
        $allowedPrimaryDomains = $this->getAllowedPrimaryDomains();
        if ($allowedPrimaryDomains === []) {
            return true;
        }

        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        if ($host === '') {
            return false;
        }

        foreach ($allowedPrimaryDomains as $primaryDomain) {
            $primaryDomain = strtolower($primaryDomain);
            if ($host === $primaryDomain || str_ends_with($host, '.' . $primaryDomain)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 获取服务商的排序顺序（用于非官方服务商列表展示）.
     * 排序优先级与当前服务商模板展示顺序保持一致。
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
            self::Tencent => 9,
            self::Baidu => 10,
            self::SCNet => 11,
            self::Moonshot => 12,
            self::BigModel => 13,
            self::MiniMax => 14,
            self::SiliconFlow => 15,
            default => 999, // 其他服务商排在最后
        };
    }

    /**
     * 获取模型实际使用的请求地址。
     */
    private function getModelUrl(AbstractProviderConfigItem $config): string
    {
        return $config->getUrl();
    }
}
