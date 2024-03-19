<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Facade;

use App\Domain\Flow\Entity\MagicFlowDraftEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowDraftQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface MagicFlowDraftRepositoryInterface
{
    public function save(FlowDataIsolation $dataIsolation, MagicFlowDraftEntity $magicFlowDraftEntity): MagicFlowDraftEntity;

    public function getByCode(FlowDataIsolation $dataIsolation, string $code): ?MagicFlowDraftEntity;

    public function getByFlowCodeAndCode(FlowDataIsolation $dataIsolation, string $flowCode, string $code): ?MagicFlowDraftEntity;

    /**
     * @return array{total: int, list: array<MagicFlowDraftEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFLowDraftQuery $query, Page $page): array;

    public function remove(FlowDataIsolation $dataIsolation, MagicFlowDraftEntity $magicFlowDraftEntity): void;

    public function clearEarlyRecords(FlowDataIsolation $dataIsolation, string $flowCode): void;
}
