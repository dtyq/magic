<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Facade;

use App\Domain\Flow\Entity\MagicFlowTriggerTestcaseEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowTriggerTestcaseQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface MagicFlowTriggerTestcaseRepositoryInterface
{
    public function save(FlowDataIsolation $dataIsolation, MagicFlowTriggerTestcaseEntity $magicFlowTriggerTestcaseEntity): MagicFlowTriggerTestcaseEntity;

    public function getByCode(FlowDataIsolation $dataIsolation, string $code): ?MagicFlowTriggerTestcaseEntity;

    public function getByFlowCodeAndCode(FlowDataIsolation $dataIsolation, string $flowCode, string $code): ?MagicFlowTriggerTestcaseEntity;

    /**
     * @return array{total: int, list: array<MagicFlowTriggerTestcaseEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFLowTriggerTestcaseQuery $query, Page $page): array;

    public function remove(FlowDataIsolation $dataIsolation, MagicFlowTriggerTestcaseEntity $magicFlowTriggerTestcaseEntity): void;
}
