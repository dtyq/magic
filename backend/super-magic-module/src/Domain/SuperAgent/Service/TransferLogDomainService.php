<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TransferLogEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TransferLogRepositoryInterface;

/**
 * Transfer Log Domain Service.
 *
 * Handles audit logging for transfer operations.
 * Separated from TransferDomainService to follow single responsibility principle.
 */
class TransferLogDomainService
{
    public function __construct(
        private readonly TransferLogRepositoryInterface $transferLogRepository
    ) {
    }

    /**
     * Save transfer audit log.
     */
    public function saveLog(TransferLogEntity $logEntity): TransferLogEntity
    {
        return $this->transferLogRepository->save($logEntity);
    }

    /**
     * Find transfer log by ID.
     */
    public function getLogById(int $id): ?TransferLogEntity
    {
        return $this->transferLogRepository->findById($id);
    }

    /**
     * Get transfer logs by batch ID.
     *
     * @return TransferLogEntity[]
     */
    public function getLogsByBatchId(string $batchId): array
    {
        return $this->transferLogRepository->findByBatchId($batchId);
    }

    /**
     * Get transfer logs by user (as sender or receiver).
     *
     * @return TransferLogEntity[]
     */
    public function getLogsByUserId(string $userId, int $page = 1, int $pageSize = 20): array
    {
        return $this->transferLogRepository->findByUserId($userId, $page, $pageSize);
    }

    /**
     * Get transfer logs by organization code.
     *
     * @return TransferLogEntity[]
     */
    public function getLogsByOrganization(string $organizationCode, int $page = 1, int $pageSize = 20): array
    {
        return $this->transferLogRepository->findByOrganization($organizationCode, $page, $pageSize);
    }

    /**
     * Count transfer logs by user ID.
     */
    public function countLogsByUserId(string $userId): int
    {
        return $this->transferLogRepository->countByUserId($userId);
    }
}
