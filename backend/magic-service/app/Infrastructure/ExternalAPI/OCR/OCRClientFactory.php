<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\OCR;

use App\Infrastructure\ExternalAPI\OCR\Config\VolceOCRConfig;
use InvalidArgumentException;

class OCRClientFactory
{
    public function getClient(OCRClientType $type, array $config = []): OCRClientInterface
    {
        $providerConfigs = array_column($config['providers'] ?? [], null, 'provider');
        return match ($type) {
            OCRClientType::Volcengine => make(VolceOCRClient::class, ['ocrConfig' => $this->buildVolceOCRConfig($providerConfigs[OCRClientType::Volcengine->value] ?? [])]),
            default => throw new InvalidArgumentException("Unsupported OCR client type: {$type->name}"),
        };
    }

    private function buildVolceOCRConfig(array $config): VolceOCRConfig
    {
        // 从配置中提取 access_key 和 secret_key
        $accessKey = $config['access_key'] ?? '';
        $secretKey = $config['secret_key'] ?? '';

        return make(VolceOCRConfig::class, [
            'accessKey' => $accessKey,
            'secretKey' => $secretKey,
        ]);
    }
}
