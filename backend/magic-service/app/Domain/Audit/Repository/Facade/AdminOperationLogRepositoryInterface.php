<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\Repository\Facade;

use App\Domain\Audit\Entity\AdminOperationLogEntity;
use App\Infrastructure\Core\ValueObject\Page;

/**
 * 管理员操作日志仓储接口.
 */
interface AdminOperationLogRepositoryInterface
{
    /**
     * 保存操作日志.
     *
     * @param string $organizationCode 组织代码
     * @param AdminOperationLogEntity $entity 日志实体
     * @return AdminOperationLogEntity 保存后的实体（包含ID）
     */
    public function save(string $organizationCode, AdminOperationLogEntity $entity): AdminOperationLogEntity;

    /**
     * 批量保存操作日志（性能优化）.
     *
     * @param string $organizationCode 组织代码
     * @param AdminOperationLogEntity[] $entities 日志实体数组
     */
    public function batchSave(string $organizationCode, array $entities): void;

    /**
     * 根据ID获取操作日志.
     *
     * @param string $organizationCode 组织代码
     * @param int $id 日志ID
     * @return null|AdminOperationLogEntity 日志实体，不存在时返回null
     */
    public function getById(string $organizationCode, int $id): ?AdminOperationLogEntity;

    /**
     * 查询操作日志列表.
     *
     * @param string $organizationCode 组织代码
     * @param Page $page 分页对象
     * @param null|array $filters 过滤条件
     *                            - user_id: 用户ID
     *                            - resource_code: 资源代码
     *                            - operation_code: 操作代码
     *                            - start_time: 开始时间（DateTime或字符串）
     *                            - end_time: 结束时间（DateTime或字符串）
     * @return array{total: int, list: AdminOperationLogEntity[]} 返回总数和日志列表
     */
    public function queries(string $organizationCode, Page $page, ?array $filters = null): array;
}
