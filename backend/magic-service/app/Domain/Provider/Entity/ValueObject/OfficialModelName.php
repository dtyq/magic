<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

/**
 * 为了解决有些模型是没有 model.
 */
enum OfficialModelName: string
{
    // 美图AI超清
    case IMAGE_HEIGHT_MEI_TU = 'image_height_mei_tu';
}
