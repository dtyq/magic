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
        $this->auditLogRepository->create($entity);
    }

    /**
     * @param array<string, mixed> $usage
     */
    public function backfillStreamUsageByRequestId(string $requestId, string $productCode, array $usage): void
    {
        $this->auditLogRepository->backfillStreamUsageByRequestId($requestId, $productCode, $usage);
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
