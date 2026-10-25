<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Event;

final readonly class SlidesTemplateCreatedEvent
{
    public function __construct(
        public string $slidesTemplateId,
        public string $organizationCode,
        public string $operatorId,
    ) {
    }
}
