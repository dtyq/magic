<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ImageGenerate;

use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;
use App\Domain\ModelGateway\Entity\AccessTokenEntity;

class DefaultWatermarkPolicy implements WatermarkPolicyInterface
{
    public function apply(AccessTokenEntity $accessTokenEntity, ?WatermarkConfig $watermarkConfig = null): ?WatermarkConfig
    {
        return $watermarkConfig;
    }
}
