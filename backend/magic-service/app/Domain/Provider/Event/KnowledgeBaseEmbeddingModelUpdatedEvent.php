<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Event;

use App\Domain\Provider\Entity\AiAbilityEntity;

/** Knowledge-base embedding capability configuration update event. */
final readonly class KnowledgeBaseEmbeddingModelUpdatedEvent
{
    public function __construct(
        public AiAbilityEntity $oldEntity,
        public AiAbilityEntity $newEntity,
    ) {
    }
}
