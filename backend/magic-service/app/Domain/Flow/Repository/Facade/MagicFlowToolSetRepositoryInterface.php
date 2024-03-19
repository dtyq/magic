<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Facade;

use App\Domain\Flow\Entity\MagicFlowToolSetEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowToolSetQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface MagicFlowToolSetRepositoryInterface
{
    public function save(FlowDataIsolation $dataIsolation, MagicFlowToolSetEntity $magicFlowToolSetEntity): MagicFlowToolSetEntity;

    public function destroy(FlowDataIsolation $dataIsolation, string $code): void;

    /**
     * @return array{total: int, list: array<MagicFlowToolSetEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFlowToolSetQuery $query, Page $page): array;

    public function getByCode(FlowDataIsolation $dataIsolation, string $code): ?MagicFlowToolSetEntity;
}
