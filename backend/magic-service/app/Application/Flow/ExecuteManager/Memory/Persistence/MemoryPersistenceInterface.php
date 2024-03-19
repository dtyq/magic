<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Memory\Persistence;

use App\Application\Flow\ExecuteManager\Memory\LLMMemoryMessage;
use App\Application\Flow\ExecuteManager\Memory\MemoryQuery;

interface MemoryPersistenceInterface
{
    /**
     * @return array<LLMMemoryMessage>
     */
    public function queries(MemoryQuery $memoryQuery, array $ignoreMessageIds = []): array;

    public function store(LLMMemoryMessage $LLMMemoryMessage): void;
}
