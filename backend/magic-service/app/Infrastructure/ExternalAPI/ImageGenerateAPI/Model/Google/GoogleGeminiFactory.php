<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\Client\AIStudioClient;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\Client\GoogleGeminiInterface;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\Client\VertexAIClient;

class GoogleGeminiFactory
{
    public static function create(
        array $config,
        string $modelId = 'gemini-2.5-flash-image',
        ?string $proxyUrl = null
    ): GoogleGeminiInterface {
        if (empty($config['auth_type'])) {
            // 默认返回 AI Studio Client
            return new AIStudioClient($config, $modelId, $proxyUrl);
        }

        return match ($config['auth_type']) {
            // 判断是否为 Vertex AI 模式
            'service_account' => new VertexAIClient($config, $modelId, $proxyUrl),
            // 默认返回 AI Studio Client
            default => new AIStudioClient($config, $modelId, $proxyUrl),
        };
    }
}
