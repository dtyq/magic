<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Repository\Facade;

use App\Domain\Audit\ModelCall\Entity\AuditLogEntity;

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
     * 游标分页查询审计日志列表.
     * filters['type'] 未传或为空时，默认排除 type=EMBEDDING；传入 type（含 EMBEDDING）则按该值精确筛选.
     * @param array<string, mixed> $filters
     * @param string $currentOrganizationCode 当前登录组织编码
     * @param bool $isOfficialOrganization 是否官方组织
     * @param ?string $cursorId 游标记录 ID（上一页最后/第一条记录的主键 id）
     * @param string $direction 翻页方向：next（下一页）/ prev（上一页）
     * @return array{list: array, next_cursor_id: ?string, prev_cursor_id: ?string, has_more: bool}
     */
    public function queries(
        int $pageSize,
        array $filters = [],
        string $currentOrganizationCode = '',
        bool $isOfficialOrganization = false,
        ?string $cursorId = null,
        string $direction = 'next'
    ): array;

    /**
     * 模型调用统计：返回 summary / trend / breakdown 原始数据.
     *
     * @param array<string, mixed> $filters
     * @return array{summary: array, trend: array, breakdown: array}
     */
    public function statistics(
        array $filters,
        string $currentOrganizationCode,
        bool $isOfficialOrganization
    ): array;
}
