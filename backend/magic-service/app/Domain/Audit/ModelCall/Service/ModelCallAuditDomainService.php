<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Service;

use App\Domain\Audit\ModelCall\Entity\AuditLogEntity;
use App\Domain\Audit\ModelCall\Repository\Facade\AuditLogRepositoryInterface;

/**
 * 模型调用审计领域服务：持久化与查询经此中转，不暴露仓储给 Application 层.
 */
readonly class ModelCallAuditDomainService
{
    public function __construct(
        private AuditLogRepositoryInterface $auditLogRepository
    ) {
    }

    public function record(AuditLogEntity $entity): void
    {
        $eventId = trim((string) ($entity->getEventId() ?? ''));
        if ($eventId !== '') {
            $this->auditLogRepository->createOrUpdateAuditByEventId($entity);

            return;
        }
        $this->auditLogRepository->create($entity);
    }

    public function recordPointsByEventId(string $eventId, int $points): void
    {
        $this->auditLogRepository->recordPointsByEventId($eventId, $points);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{list: array, next_cursor_id: ?string, prev_cursor_id: ?string, has_more: bool}
     */
    public function queries(
        int $pageSize,
        array $filters = [],
        string $currentOrganizationCode = '',
        bool $isOfficialOrganization = false,
        ?string $cursorId = null,
        string $direction = 'next'
    ): array {
        return $this->auditLogRepository->queries(
            $pageSize,
            $filters,
            $currentOrganizationCode,
            $isOfficialOrganization,
            $cursorId,
            $direction
        );
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{summary: array, trend: array, breakdown: array}
     */
    public function statistics(
        array $filters,
        string $currentOrganizationCode,
        bool $isOfficialOrganization
    ): array {
        return $this->auditLogRepository->statistics(
            $filters,
            $currentOrganizationCode,
            $isOfficialOrganization
        );
    }
}
