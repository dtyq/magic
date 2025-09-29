<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageScheduleLogEntity;

/**
 * Message schedule log repository interface.
 */
interface MessageScheduleLogRepositoryInterface
{
    /**
     * Create message schedule log.
     */
    public function create(MessageScheduleLogEntity $messageScheduleLog): MessageScheduleLogEntity;

    /**
     * Find message schedule log by ID.
     */
    public function findById(int $id): ?MessageScheduleLogEntity;

    /**
     * Find message schedule logs by message schedule ID.
     */
    public function findByMessageScheduleId(int $messageScheduleId): array;

    /**
     * Update message schedule log status.
     */
    public function updateStatus(int $id, int $status, ?string $errorMessage = null): bool;

    /**
     * Get message schedule logs by conditions with pagination.
     */
    public function getLogsByConditions(
        array $conditions = [],
        int $page = 1,
        int $pageSize = 10,
        string $orderBy = 'executed_at',
        string $orderDirection = 'desc'
    ): array;
}
