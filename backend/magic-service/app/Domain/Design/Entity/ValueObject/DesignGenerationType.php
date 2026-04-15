<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Entity\ValueObject;

enum DesignGenerationType: string
{
    case TEXT_TO_VIDEO = 'text_to_video';
    case IMAGE_TO_VIDEO = 'image_to_video';
}
