<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Volcengine\SpeechRecognition\Config;

/**
 * 火山引擎语音识别配置类.
 */
class SpeechRecognitionConfig
{
    public function __construct(
        private string $appKey = '',
        private string $accessKey = '',
        private string $cluster = ''
    ) {
    }

    /**
     * 获取 App Key.
     */
    public function getAppKey(): string
    {
        return $this->appKey;
    }

    /**
     * 获取 Access Key.
     */
    public function getAccessKey(): string
    {
        return $this->accessKey;
    }

    public function getCluster(): string
    {
        return $this->cluster;
    }
}
