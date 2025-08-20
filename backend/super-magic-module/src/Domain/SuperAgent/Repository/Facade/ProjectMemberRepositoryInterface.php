<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectMemberEntity;

/**
 * 项目成员仓储接口.
 *
 * 提供项目成员数据的持久化操作
 */
interface ProjectMemberRepositoryInterface
{
    /**
     * 批量插入项目成员.
     *
     * @param ProjectMemberEntity[] $projectMemberEntities 项目成员实体数组
     */
    public function insert(array $projectMemberEntities): void;

    /**
     * 根据项目ID删除所有成员.
     *
     * @param int $projectId 项目ID
     * @return int 删除的记录数
     */
    public function deleteByProjectId(int $projectId): int;

    /**
     * 根据ID数组批量删除成员.
     *
     * @param array $ids 成员ID数组
     * @return int 删除的记录数
     */
    public function deleteByIds(array $ids): int;

    /**
     * 检查项目和用户的成员关系是否存在.
     *
     * @param int $projectId 项目ID
     * @param string $userId 用户ID
     * @return bool 存在返回true，否则返回false
     */
    public function existsByProjectAndUser(int $projectId, string $userId): bool;

    /**
     * 检查项目和部门列表的成员关系是否存在.
     *
     * @param int $projectId 项目ID
     * @param array $departmentIds 部门ID数组
     * @return bool 存在返回true，否则返回false
     */
    public function existsByProjectAndDepartments(int $projectId, array $departmentIds): bool;

    /**
     * 根据项目ID获取所有项目成员.
     *
     * @param int $projectId 项目ID
     * @return ProjectMemberEntity[] 项目成员实体数组
     */
    public function findByProjectId(int $projectId): array;

    /**
     * 根据用户和部门获取项目ID列表及总数.
     *
     * @param string $userId 用户ID
     * @param array $departmentIds 部门ID数组
     * @param null|string $name 项目名称模糊搜索关键词
     * @return array ['total' => int, 'project_ids' => array]
     */
    public function getProjectIdsByUserAndDepartments(string $userId, array $departmentIds = [], ?string $name = null): array;

    /**
     * 批量获取项目成员总数.
     *
     * @param array $projectIds 项目ID数组
     * @return array [project_id => total_count]
     */
    public function getProjectMembersCounts(array $projectIds): array;

    /**
     * 批量获取项目前N个成员预览.
     *
     * @param array $projectIds 项目ID数组
     * @param int $limit 限制数量，默认4个
     * @return array [project_id => [['target_type' => '', 'target_id' => ''], ...]]
     */
    public function getProjectMembersPreview(array $projectIds, int $limit = 4): array;
}
