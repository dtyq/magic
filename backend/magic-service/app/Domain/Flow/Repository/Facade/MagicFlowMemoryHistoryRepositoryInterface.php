<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Facade;

use App\Domain\Flow\Entity\MagicFlowMemoryHistoryEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowMemoryHistoryQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface MagicFlowMemoryHistoryRepositoryInterface
{
    public function create(FlowDataIsolation $dataIsolation, MagicFlowMemoryHistoryEntity $magicFlowMemoryHistoryEntity): MagicFlowMemoryHistoryEntity;

    /**
     * @return array{total: int, list: array<MagicFlowMemoryHistoryEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFlowMemoryHistoryQuery $query, Page $page): array;

    public function removeByConversationId(FlowDataIsolation $dataIsolation, string $conversationId): void;
}
