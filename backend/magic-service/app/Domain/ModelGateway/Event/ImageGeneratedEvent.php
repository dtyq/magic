<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Event;

use App\Domain\ModelGateway\Entity\ImageGeneratedEntity;
use App\Infrastructure\Core\AbstractEvent;

class ImageGeneratedEvent extends AbstractEvent
{
    public function __construct(
        public ImageGeneratedEntity $imageGeneratedEntity,
    ) {
    }
}
