<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Event;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;

class KnowledgeBaseRemovedEvent
{
    public function __construct(
        public KnowledgeBaseDataIsolation $dataIsolation,
        public KnowledgeBaseEntity $magicFlowKnowledgeEntity,
    ) {
    }
}
