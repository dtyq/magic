<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use Hyperf\Odin\Model\AwsBedrockModel;
use Hyperf\Odin\Model\AzureOpenAIModel;
use Hyperf\Odin\Model\DoubaoModel;
use Hyperf\Odin\Model\GeminiModel;
use Hyperf\Odin\Model\OpenAIModel;

enum ProviderCode: string
{
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

    public function getImplementation(): string
    {
        return match ($this) {
            self::MicrosoftAzure => AzureOpenAIModel::class,
            self::Volcengine => DoubaoModel::class,
            self::AWSBedrock => AwsBedrockModel::class,
            self::Gemini => GeminiModel::class,
            default => OpenAIModel::class,
        };
    }

    public function getImplementationConfig(ProviderConfigItem $config, string $name = ''): array
    {
        $config->setUrl($this->getModelUrl($config));

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
            self::Gemini => [
                'api_key' => $config->getApiKey(),
                'base_url' => $config->getUrl(),
                'auto_cache_config' => [
                    'enable_cache' => config('llm.gemini_auto_cache', true),
                ],
            ],
            default => [
                'api_key' => $config->getApiKey(),
                'base_url' => $config->getUrl(),
                'auto_cache_config' => [
                    'auto_enabled' => config('llm.openai_auto_cache', true),
                ],
            ],
        };
    }

    public function isOfficial(): bool
    {
        return $this === self::Official;
    }

    private function getModelUrl(ProviderConfigItem $config): string
    {
        return $config->getUrl() ?? '';
    }
}
