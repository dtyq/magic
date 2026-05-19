<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Entity\ValueObject;

enum DesignGenerationAssetType: string
{
    case VIDEO = 'video';
    case IMAGE = 'image';
    case AUDIO = 'audio';
}
