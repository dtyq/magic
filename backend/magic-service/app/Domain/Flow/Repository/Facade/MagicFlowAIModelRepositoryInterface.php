<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Facade;

use App\Domain\Flow\Entity\MagicFlowAIModelEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowAIModelQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface MagicFlowAIModelRepositoryInterface
{
    public function save(FlowDataIsolation $dataIsolation, MagicFlowAIModelEntity $magicFlowAIModelEntity): MagicFlowAIModelEntity;

    public function getByName(FlowDataIsolation $dataIsolation, string $name): ?MagicFlowAIModelEntity;

    /**
     * @return array{total: int, list: array<MagicFlowAIModelEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFlowAIModelQuery $query, Page $page): array;
}
