<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Service;

use App\Domain\Audit\ModelCall\Entity\AuditLogEntity;
use App\Domain\Audit\ModelCall\Repository\Facade\AuditLogRepositoryInterface;
use App\Infrastructure\Core\ValueObject\Page;

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
     * @return array{total: int, list: array<int, array<string, mixed>>}
     */
    public function queries(
        Page $page,
        array $filters = [],
        string $currentOrganizationCode = '',
        bool $isOfficialOrganization = false
    ): array {
        return $this->auditLogRepository->queries(
            $page,
            $filters,
            $currentOrganizationCode,
            $isOfficialOrganization
        );
    }
}
