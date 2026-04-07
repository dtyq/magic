<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

final class VideoGatewayEndpoint
{
    public static function fromModel(string $model): string
    {
        return 'video:' . $model;
    }
}
