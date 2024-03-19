<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ImageGenerate;

use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;
use App\Domain\ModelGateway\Entity\AccessTokenEntity;

interface WatermarkPolicyInterface
{
    /**
     * 根据组织配置决定是否启用或调整水印.
     */
    public function apply(AccessTokenEntity $accessTokenEntity, ?WatermarkConfig $watermarkConfig = null): ?WatermarkConfig;
}
