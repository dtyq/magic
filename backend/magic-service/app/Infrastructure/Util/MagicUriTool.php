<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util;

class MagicUriTool
{
    public static function getImagesGenerationsUri(): string
    {
        return '/v2/images/generations';
    }

    public static function getModelsUri(): string
    {
        return '/v1/models';
    }
}
