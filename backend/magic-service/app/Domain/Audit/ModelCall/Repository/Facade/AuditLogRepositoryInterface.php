<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Repository\Facade;

use App\Domain\Audit\ModelCall\Entity\AuditLogEntity;
use App\Infrastructure\Core\ValueObject\Page;

interface AuditLogRepositoryInterface
{
    /**
     * 创建审计日志.
     */
    public function create(AuditLogEntity $entity): void;

    /**
     * 回填流式请求的 usage.
     *
     * @param array<string, mixed> $usage
     */
    public function backfillStreamUsageByRequestId(string $requestId, string $productCode, array $usage): void;

    /**
     * 查询审计日志列表.
     * @param array<string, mixed> $filters
     * @param string $currentOrganizationCode 当前登录组织编码
     * @param bool $isOfficialOrganization 是否官方组织
     * @return array{total: int, list: array<int, array<string, mixed>>}
     */
    public function queries(
        Page $page,
        array $filters = [],
        string $currentOrganizationCode = '',
        bool $isOfficialOrganization = false
    ): array;
}
