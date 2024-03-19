<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI;

enum ImageGenerateType: string
{
    case URL = 'URL';
    case BASE_64 = 'base_64';

    public function isBase64(): bool
    {
        return $this === self::BASE_64;
    }
}
