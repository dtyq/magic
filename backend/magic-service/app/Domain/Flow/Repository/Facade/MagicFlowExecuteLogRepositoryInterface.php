<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Facade;

use App\Domain\Flow\Entity\MagicFlowExecuteLogEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Infrastructure\Core\ValueObject\Page;

interface MagicFlowExecuteLogRepositoryInterface
{
    public function create(FlowDataIsolation $dataIsolation, MagicFlowExecuteLogEntity $magicFlowExecuteLogEntity): MagicFlowExecuteLogEntity;

    public function updateStatus(FlowDataIsolation $dataIsolation, MagicFlowExecuteLogEntity $magicFlowExecuteLogEntity): void;

    /**
     * @return array<MagicFlowExecuteLogEntity>
     */
    public function getRunningTimeoutList(FlowDataIsolation $dataIsolation, int $timeout, Page $page): array;

    public function getByExecuteId(FlowDataIsolation $dataIsolation, string $executeId): ?MagicFlowExecuteLogEntity;

    public function incrementRetryCount(FlowDataIsolation $dataIsolation, MagicFlowExecuteLogEntity $magicFlowExecuteLogEntity): void;
}
