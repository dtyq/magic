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

    public function getImplementation(): string
    {
        return match ($this) {
            self::MicrosoftAzure => AzureOpenAIModel::class,
            self::Volcengine => DoubaoModel::class,
            self::AWSBedrock => AwsBedrockModel::class,
            default => OpenAIModel::class,
        };
    }

    public function getImplementationConfig(ProviderConfigItem $config, string $name = ''): array
    {
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
                'auto_cache' => true,
            ],
            default => [
                'api_key' => $config->getApiKey(),
                'base_url' => $config->getUrl(),
            ],
        };
    }
}
