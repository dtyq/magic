<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Event;

use App\Domain\Design\Entity\ImageGenerationEntity;

class ImageGenerationTaskCreatedEvent
{
    public function __construct(
        public ImageGenerationEntity $imageGenerationEntity
    ) {
    }
}
