<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI;

enum AzureAuthType: string
{
    /**
     * 使用 api-key 请求头（Azure OpenAI 原生鉴权）.
     */
    case ApiKey = 'api_key';

    /**
     * 使用 Authorization: Bearer 请求头（Token 鉴权）.
     */
    case Token = 'token';

    public static function fromConfig(string $value): self
    {
        return self::tryFrom($value) ?? self::ApiKey;
    }
}
