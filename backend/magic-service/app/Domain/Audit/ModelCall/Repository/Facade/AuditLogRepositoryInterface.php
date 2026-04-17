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
     * 按 event_id 插入或更新审计行（审计字段不含 points，不覆盖计费已写入积分）.
     */
    public function createOrUpdateAuditByEventId(AuditLogEntity $entity): void;

    /**
     * 计费侧按 event_id 回写积分（先 UPDATE，无行则占位 INSERT，冲突则再 UPDATE）.
     */
    public function recordPointsByEventId(string $eventId, int $points): void;

    /**
     * 查询审计日志列表.
     * filters['type'] 未传或为空时，默认排除 type=EMBEDDING；传入 type（含 EMBEDDING）则按该值精确筛选.
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
