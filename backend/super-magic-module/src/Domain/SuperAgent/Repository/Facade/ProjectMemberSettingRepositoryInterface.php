<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectMemberSettingEntity;

/**
 * 项目成员设置仓储接口.
 *
 * 提供项目成员设置数据的持久化操作
 */
interface ProjectMemberSettingRepositoryInterface
{
    /**
     * 根据用户ID和项目ID查找设置.
     *
     * @param string $userId 用户ID
     * @param int $projectId 项目ID
     * @return null|ProjectMemberSettingEntity 设置实体或null
     */
    public function findByUserAndProject(string $userId, int $projectId): ?ProjectMemberSettingEntity;

    /**
     * 创建项目成员设置.
     *
     * @param string $userId 用户ID
     * @param int $projectId 项目ID
     * @param string $organizationCode 组织编码
     * @return ProjectMemberSettingEntity 创建的设置实体
     */
    public function create(string $userId, int $projectId, string $organizationCode): ProjectMemberSettingEntity;

    /**
     * 创建或更新项目成员设置.
     *
     * @param ProjectMemberSettingEntity $entity 设置实体
     * @return ProjectMemberSettingEntity 保存后的实体
     */
    public function save(ProjectMemberSettingEntity $entity): ProjectMemberSettingEntity;

    /**
     * 更新置顶状态（假设记录已存在）.
     *
     * @param string $userId 用户ID
     * @param int $projectId 项目ID
     * @param bool $isPinned 是否置顶
     * @return bool 更新成功返回true
     */
    public function updatePinStatus(string $userId, int $projectId, bool $isPinned): bool;

    /**
     * 批量获取用户的置顶项目ID列表.
     *
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @return array 置顶的项目ID数组
     */
    public function getPinnedProjectIds(string $userId, string $organizationCode): array;

    /**
     * 批量获取用户在多个项目的设置.
     *
     * @param string $userId 用户ID
     * @param array $projectIds 项目ID数组
     * @return array [project_id => ProjectMemberSettingEntity, ...]
     */
    public function findByUserAndProjects(string $userId, array $projectIds): array;

    /**
     * 更新最后活跃时间.
     *
     * @param string $userId 用户ID
     * @param int $projectId 项目ID
     * @return bool 更新成功返回true
     */
    public function updateLastActiveTime(string $userId, int $projectId): bool;

    /**
     * 删除项目相关的所有设置.
     *
     * @param int $projectId 项目ID
     * @return int 删除的记录数
     */
    public function deleteByProjectId(int $projectId): int;

    /**
     * 删除用户相关的所有设置.
     *
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @return int 删除的记录数
     */
    public function deleteByUser(string $userId, string $organizationCode): int;

    /**
     * 设置项目快捷方式（绑定到工作区）.
     *
     * @param string $userId 用户ID
     * @param int $projectId 项目ID
     * @param int $workspaceId 工作区ID
     * @param string $organizationCode 组织编码
     * @return bool 设置成功返回true
     */
    public function setProjectShortcut(string $userId, int $projectId, int $workspaceId, string $organizationCode): bool;

    /**
     * 取消项目快捷方式（取消工作区绑定）.
     *
     * @param string $userId 用户ID
     * @param int $projectId 项目ID
     * @return bool 取消成功返回true
     */
    public function cancelProjectShortcut(string $userId, int $projectId): bool;

    /**
     * 检查项目是否已设置快捷方式.
     *
     * @param string $userId 用户ID
     * @param int $projectId 项目ID
     * @param int $workspaceId 工作区ID
     * @return bool 已设置返回true
     */
    public function hasProjectShortcut(string $userId, int $projectId, int $workspaceId): bool;
}
