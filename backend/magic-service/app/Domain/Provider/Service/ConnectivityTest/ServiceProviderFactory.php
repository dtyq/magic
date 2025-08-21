<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service\ConnectivityTest;

use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Service\ConnectivityTest\VLM\MiracleVisionProvider;
use App\Domain\Provider\Service\ConnectivityTest\VLM\QwenProvider;
use App\Domain\Provider\Service\ConnectivityTest\VLM\TTAPIProvider;
use App\Domain\Provider\Service\ConnectivityTest\VLM\VLMVolcengineProvider;
use Exception;

class ServiceProviderFactory
{
    public static function get(ProviderCode $serviceProviderCode, Category $serviceProviderCategory): IProvider
    {
        return match ($serviceProviderCategory) {
            Category::VLM => match ($serviceProviderCode) {
                ProviderCode::Volcengine => new VLMVolcengineProvider(),
                ProviderCode::TTAPI => new TTAPIProvider(),
                ProviderCode::MiracleVision => new MiracleVisionProvider(),
                ProviderCode::Qwen => new QwenProvider(),
                default => throw new Exception('Invalid service provider code for VLM category'),
            },
            default => throw new Exception('Invalid service provider category'),
        };
    }
}
