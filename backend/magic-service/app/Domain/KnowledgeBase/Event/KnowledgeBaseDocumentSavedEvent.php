<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Event;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseDocumentEntity;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;

class KnowledgeBaseDocumentSavedEvent
{
    public function __construct(
        public KnowledgeBaseDataIsolation $dataIsolation,
        public KnowledgeBaseEntity $knowledgeBaseEntity,
        public KnowledgeBaseDocumentEntity $knowledgeBaseDocumentEntity,
        public bool $create,
    ) {
    }
}
