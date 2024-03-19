<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Config;

use Dtyq\EasyDingTalk\Kernel\Contracts\Endpoint\EndpointConfig;

class OpenDevEndpointConfig extends EndpointConfig
{
    private DingCallbackConfig $dingCallbackConfig;

    private string $appKey;

    private string $appSecret;

    public function loadOptions(array $options = []): void
    {
        $this->appKey = $options['app_key'] ?? '';
        $this->appSecret = $options['app_secret'] ?? '';
        $this->dingCallbackConfig = new DingCallbackConfig($options['callback_config'] ?? []);
    }

    public function getDingCallbackConfig(): DingCallbackConfig
    {
        return $this->dingCallbackConfig;
    }

    public function getAppKey(): string
    {
        return $this->appKey;
    }

    public function getAppSecret(): string
    {
        return $this->appSecret;
    }
}
