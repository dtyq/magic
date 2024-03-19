<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TransferLogEntity;

/**
 * Transfer log repository interface.
 *
 * Provides persistence operations for transfer audit logs.
 */
interface TransferLogRepositoryInterface
{
    /**
     * Save transfer log entity.
     *
     * @param TransferLogEntity $logEntity The log entity to save
     * @return TransferLogEntity The saved entity with ID
     */
    public function save(TransferLogEntity $logEntity): TransferLogEntity;

    /**
     * Find transfer log by ID.
     *
     * @param int $id The log ID
     * @return null|TransferLogEntity The log entity or null if not found
     */
    public function findById(int $id): ?TransferLogEntity;

    /**
     * Find transfer logs by batch ID.
     *
     * @param string $batchId The batch ID
     * @return TransferLogEntity[] Array of log entities
     */
    public function findByBatchId(string $batchId): array;

    /**
     * Find transfer logs by user ID (as sender or receiver).
     *
     * @param string $userId The user ID
     * @param int $page Page number
     * @param int $pageSize Page size
     * @return TransferLogEntity[] Array of log entities
     */
    public function findByUserId(string $userId, int $page = 1, int $pageSize = 20): array;

    /**
     * Find transfer logs by organization code.
     *
     * @param string $organizationCode The organization code
     * @param int $page Page number
     * @param int $pageSize Page size
     * @return TransferLogEntity[] Array of log entities
     */
    public function findByOrganization(string $organizationCode, int $page = 1, int $pageSize = 20): array;

    /**
     * Count transfer logs by user ID.
     *
     * @param string $userId The user ID
     * @return int The count
     */
    public function countByUserId(string $userId): int;
}
