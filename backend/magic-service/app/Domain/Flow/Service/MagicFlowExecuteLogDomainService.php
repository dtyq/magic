<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowExecuteLogEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Repository\Facade\MagicFlowExecuteLogRepositoryInterface;
use App\Infrastructure\Core\ValueObject\Page;

class MagicFlowExecuteLogDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly MagicFlowExecuteLogRepositoryInterface $magicFlowExecuteLogRepository,
    ) {
    }

    public function create(FlowDataIsolation $dataIsolation, MagicFlowExecuteLogEntity $magicFlowExecuteLogEntity): MagicFlowExecuteLogEntity
    {
        $magicFlowExecuteLogEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $magicFlowExecuteLogEntity->prepareForCreation();
        return $this->magicFlowExecuteLogRepository->create($dataIsolation, $magicFlowExecuteLogEntity);
    }

    public function updateStatus(FlowDataIsolation $dataIsolation, MagicFlowExecuteLogEntity $magicFlowExecuteLogEntity): void
    {
        $this->magicFlowExecuteLogRepository->updateStatus($dataIsolation, $magicFlowExecuteLogEntity);
    }

    public function incrementRetryCount(FlowDataIsolation $dataIsolation, MagicFlowExecuteLogEntity $magicFlowExecuteLogEntity): void
    {
        $this->magicFlowExecuteLogRepository->incrementRetryCount($dataIsolation, $magicFlowExecuteLogEntity);
    }

    /**
     * @return array<MagicFlowExecuteLogEntity>
     */
    public function getRunningTimeoutList(FlowDataIsolation $dataIsolation, int $timeout, Page $page): array
    {
        return $this->magicFlowExecuteLogRepository->getRunningTimeoutList($dataIsolation, $timeout, $page);
    }

    public function getByExecuteId(FlowDataIsolation $dataIsolation, string $executeId): ?MagicFlowExecuteLogEntity
    {
        return $this->magicFlowExecuteLogRepository->getByExecuteId($dataIsolation, $executeId);
    }
}
