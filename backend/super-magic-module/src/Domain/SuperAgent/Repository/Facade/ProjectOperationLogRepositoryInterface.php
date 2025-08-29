<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectOperationLogEntity;

/**
 * 项目操作日志仓储接口.
 */
interface ProjectOperationLogRepositoryInterface
{
    /**
     * 保存操作日志.
     */
    public function save(ProjectOperationLogEntity $operationLog): ProjectOperationLogEntity;

    /**
     * 根据项目ID查找操作日志列表.
     *
     * @param int $projectId 项目ID
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array 日志列表
     */
    public function findByProjectId(int $projectId, int $page = 1, int $pageSize = 20): array;

    /**
     * 根据项目和用户查找操作日志.
     *
     * @param int $projectId 项目ID
     * @param string $userId 用户ID
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array 日志列表
     */
    public function findByProjectAndUser(int $projectId, string $userId, int $page = 1, int $pageSize = 20): array;

    /**
     * 根据项目和操作类型查找日志.
     *
     * @param int $projectId 项目ID
     * @param string $action 操作类型
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array 日志列表
     */
    public function findByProjectAndAction(int $projectId, string $action, int $page = 1, int $pageSize = 20): array;

    /**
     * 根据项目ID统计操作日志数量.
     *
     * @param int $projectId 项目ID
     * @return int 日志数量
     */
    public function countByProjectId(int $projectId): int;

    /**
     * 根据组织编码查找操作日志.
     *
     * @param string $organizationCode 组织编码
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array 日志列表
     */
    public function findByOrganization(string $organizationCode, int $page = 1, int $pageSize = 20): array;
}
