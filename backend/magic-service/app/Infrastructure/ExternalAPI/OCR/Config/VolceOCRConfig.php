<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\OCR\Config;

/**
 * 火山引擎 OCR 配置类.
 * 提供类型安全的配置访问方法.
 */
class VolceOCRConfig
{
    public function __construct(
        private string $accessKey = '',
        private string $secretKey = ''
    ) {
    }

    /**
     * 获取 Access Key.
     */
    public function getAccessKey(): string
    {
        return $this->accessKey;
    }

    /**
     * 获取 Secret Key.
     */
    public function getSecretKey(): string
    {
        return $this->secretKey;
    }
}
