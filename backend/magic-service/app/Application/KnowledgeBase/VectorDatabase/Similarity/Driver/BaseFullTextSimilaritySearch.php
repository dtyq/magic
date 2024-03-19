<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver;

use App\Application\KnowledgeBase\VectorDatabase\Similarity\KnowledgeSimilarityFilter;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\RetrieveConfig;

class BaseFullTextSimilaritySearch implements FullTextSimilaritySearchInterface
{
    public function search(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeSimilarityFilter $filter, KnowledgeBaseEntity $knowledgeBaseEntity, RetrieveConfig $retrieveConfig): array
    {
        return [];
    }
}
