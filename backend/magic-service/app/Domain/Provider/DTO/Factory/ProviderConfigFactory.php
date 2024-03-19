<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Factory;

use App\Domain\Provider\DTO\Item\AbstractProviderConfigItem;
use App\Domain\Provider\DTO\Item\GoogleProviderConfigItem;
use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;

class ProviderConfigFactory
{
    /**
     * 根据 provider_code 创建对应的配置项对象.
     */
    public static function create(?ProviderCode $providerCode, ?array $data = []): AbstractProviderConfigItem
    {
        if (is_null($providerCode)) {
            return new ProviderConfigItem($data);
        }
        $data = $data ?? [];

        return match ($providerCode->value) {
            ProviderCode::Google->value => new GoogleProviderConfigItem($data),
            ProviderCode::Gemini->value => new GoogleProviderConfigItem($data),
            default => new ProviderConfigItem($data),
        };
    }
}
