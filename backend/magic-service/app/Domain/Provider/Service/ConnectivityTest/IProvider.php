<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service\ConnectivityTest;

use App\Domain\Provider\DTO\Item\ProviderConfigItem;

/**
 * 服务商接口.
 */
interface IProvider
{
    /**
     * 连通性测试.
     */
    public function connectivityTestByModel(ProviderConfigItem $serviceProviderConfig, string $modelVersion): ConnectResponse;
}
