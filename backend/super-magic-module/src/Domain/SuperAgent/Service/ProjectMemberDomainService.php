<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectMemberEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectMemberSettingEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectMemberRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectMemberSettingRepositoryInterface;
use Hyperf\DbConnection\Db;

/**
 * 项目成员领域服务
 *
 * 处理项目成员相关的所有业务逻辑，包括权限验证、成员管理等
 */
class ProjectMemberDomainService
{
    public function __construct(
        private readonly ProjectMemberRepositoryInterface $projectMemberRepository,
        private readonly ProjectMemberSettingRepositoryInterface $projectMemberSettingRepository,
    ) {
    }

    /**
     * 更新项目成员 - 主业务方法.
     *
     * @param ProjectMemberEntity[] $memberEntities 成员实体数组
     */
    public function updateProjectMembers(
        string $organizationCode,
        int $projectId,
        array $memberEntities
    ): void {
        // 1. 为每个成员实体设置项目ID和组织编码
        foreach ($memberEntities as $memberEntity) {
            $memberEntity->setProjectId($projectId);
            $memberEntity->setOrganizationCode($organizationCode);
        }

        // 2. 执行更新操作
        Db::transaction(function () use ($projectId, $memberEntities) {
            // 先删除所有现有成员
            $this->projectMemberRepository->deleteByProjectId($projectId);

            // 再批量插入新成员
            if (! empty($memberEntities)) {
                $this->projectMemberRepository->insert($memberEntities);
            }
        });
    }

    /**
     * 检查用户是否为项目的用户级成员.
     */
    public function isProjectMemberByUser(int $projectId, string $userId): bool
    {
        return $this->projectMemberRepository->existsByProjectAndUser($projectId, $userId);
    }

    /**
     * 检查用户是否为项目的部门级成员.
     */
    public function isProjectMemberByDepartments(int $projectId, array $departmentIds): bool
    {
        return $this->projectMemberRepository->existsByProjectAndDepartments($projectId, $departmentIds);
    }

    /**
     * 根据项目ID获取项目成员列表.
     *
     * @return ProjectMemberEntity[] 项目成员实体数组
     */
    public function getProjectMembers(int $projectId): array
    {
        return $this->projectMemberRepository->findByProjectId($projectId);
    }

    /**
     * 根据用户和部门获取项目ID列表.
     */
    public function deleteByProjectId(int $projectId): bool
    {
        return (bool) $this->projectMemberRepository->deleteByProjectId($projectId);
    }

    /**
     * 根据用户和部门获取项目ID列表及总数.
     *
     * @return array ['total' => int, 'list' => array]
     */
    public function getProjectIdsByUserAndDepartmentsWithTotal(
        string $userId,
        array $departmentIds = [],
        ?string $name = null,
        ?string $sortField = null,
        string $sortDirection = 'desc',
        array $creatorUserIds = []
    ): array {
        return $this->projectMemberRepository->getProjectIdsByUserAndDepartments(
            $userId,
            $departmentIds,
            $name,
            $sortField,
            $sortDirection,
            $creatorUserIds
        );
    }

    /**
     * 批量获取项目成员总数.
     *
     * @return array [project_id => total_count]
     */
    public function getProjectMembersCounts(array $projectIds): array
    {
        return $this->projectMemberRepository->getProjectMembersCounts($projectIds);
    }

    /**
     * 批量获取项目前N个成员预览.
     *
     * @return ProjectMemberEntity[][]
     */
    public function getProjectMembersPreview(array $projectIds, int $limit = 4): array
    {
        return $this->projectMemberRepository->getProjectMembersPreview($projectIds, $limit);
    }

    /**
     * 获取用户创建的且有成员的项目ID列表及总数.
     *
     * @return array ['total' => int, 'list' => array]
     */
    public function getSharedProjectIdsByUserWithTotal(
        string $userId,
        string $organizationCode,
        ?string $name = null,
        int $page = 1,
        int $pageSize = 10,
        ?string $sortField = null,
        string $sortDirection = 'desc',
        array $creatorUserIds = []
    ): array {
        return $this->projectMemberRepository->getSharedProjectIdsByUser(
            $userId,
            $organizationCode,
            $name,
            $page,
            $pageSize,
            $sortField,
            $sortDirection,
            $creatorUserIds
        );
    }

    /**
     * 更新项目置顶状态.
     */
    public function updateProjectPinStatus(string $userId, int $projectId, string $organizationCode, bool $isPinned): bool
    {
        // 1. 检查数据是否存在，如果不存在先创建默认数据
        $setting = $this->projectMemberSettingRepository->findByUserAndProject($userId, $projectId);
        if ($setting === null) {
            $this->projectMemberSettingRepository->create($userId, $projectId, $organizationCode);
        }

        // 2. 更新置顶状态
        return $this->projectMemberSettingRepository->updatePinStatus($userId, $projectId, $isPinned);
    }

    /**
     * 获取用户的置顶项目ID列表.
     *
     * @return array 置顶的项目ID数组
     */
    public function getUserPinnedProjectIds(string $userId, string $organizationCode): array
    {
        return $this->projectMemberSettingRepository->getPinnedProjectIds($userId, $organizationCode);
    }

    /**
     * 批量获取用户在多个项目的设置.
     *
     * @return array [project_id => ProjectMemberSettingEntity, ...]
     */
    public function getUserProjectSettings(string $userId, array $projectIds): array
    {
        return $this->projectMemberSettingRepository->findByUserAndProjects($userId, $projectIds);
    }

    /**
     * 更新用户在项目中的最后活跃时间.
     */
    public function updateUserLastActiveTime(string $userId, int $projectId, string $organizationCode): bool
    {
        // 1. 检查数据是否存在，如果不存在先创建默认数据
        $setting = $this->projectMemberSettingRepository->findByUserAndProject($userId, $projectId);
        if ($setting === null) {
            $this->projectMemberSettingRepository->create($userId, $projectId, $organizationCode);
        }

        return $this->projectMemberSettingRepository->updateLastActiveTime($userId, $projectId);
    }

    /**
     * 删除项目时清理相关的成员设置.
     */
    public function cleanupProjectSettings(int $projectId): bool
    {
        $this->projectMemberSettingRepository->deleteByProjectId($projectId);
        return true;
    }

    /**
     * 获取协作项目的创建者用户ID列表.
     *
     * @param string $userId 当前用户ID
     * @param array $departmentIds 用户所在部门ID数组
     * @param string $organizationCode 组织代码
     * @return array 创建者用户ID数组
     */
    public function getCollaborationProjectCreatorIds(
        string $userId,
        array $departmentIds,
        string $organizationCode
    ): array {
        return $this->projectMemberRepository->getCollaborationProjectCreatorIds(
            $userId,
            $departmentIds,
            $organizationCode
        );
    }

    /**
     * 设置项目快捷方式.
     *
     * @param string $userId 用户ID
     * @param int $projectId 项目ID
     * @param int $workspaceId 工作区ID
     * @param string $organizationCode 组织编码
     * @return bool 设置成功返回true
     */
    public function setProjectShortcut(string $userId, int $projectId, int $workspaceId, string $organizationCode): bool
    {
        return $this->projectMemberSettingRepository->setProjectShortcut($userId, $projectId, $workspaceId, $organizationCode);
    }

    /**
     * 取消项目快捷方式.
     *
     * @param string $userId 用户ID
     * @param int $projectId 项目ID
     * @return bool 取消成功返回true
     */
    public function cancelProjectShortcut(string $userId, int $projectId): bool
    {
        return $this->projectMemberSettingRepository->cancelProjectShortcut($userId, $projectId);
    }

    /**
     * 检查项目是否已设置快捷方式.
     *
     * @param string $userId 用户ID
     * @param int $projectId 项目ID
     * @param int $workspaceId 工作区ID
     * @return bool 已设置返回true
     */
    public function hasProjectShortcut(string $userId, int $projectId, int $workspaceId): bool
    {
        return $this->projectMemberSettingRepository->hasProjectShortcut($userId, $projectId, $workspaceId);
    }

    /**
     * 获取用户参与的项目列表（支持协作项目筛选）.
     *
     * @param string $userId 用户ID
     * @param int $workspaceId 工作区ID（0表示不限制工作区）
     * @param bool $showCollaboration 是否显示协作项目
     * @param null|string $projectName 项目名称模糊搜索
     * @param int $page 页码
     * @param int $pageSize 每页大小
     * @param string $sortField 排序字段
     * @param string $sortDirection 排序方向
     * @return array ['total' => int, 'list' => array]
     */
    public function getParticipatedProjectsWithCollaboration(
        string $userId,
        int $workspaceId,
        bool $showCollaboration = true,
        ?string $projectName = null,
        int $page = 1,
        int $pageSize = 10,
        string $sortField = 'last_active_at',
        string $sortDirection = 'desc'
    ): array {
        // 判断是否限制工作区
        $limitWorkspace = $workspaceId > 0;

        return $this->projectMemberRepository->getParticipatedProjects(
            $userId,
            $limitWorkspace ? $workspaceId : null,
            $showCollaboration,
            $projectName,
            $page,
            $pageSize,
            $sortField,
            $sortDirection
        );
    }

    /**
     * 初始化项目成员和设置.
     *
     * @param string $userId 用户ID
     * @param int $projectId 项目ID
     * @param int $workspaceId 工作区ID
     * @param string $organizationCode 组织编码
     */
    public function initializeProjectMemberAndSettings(
        string $userId,
        int $projectId,
        int $workspaceId,
        string $organizationCode
    ): void {
        // 创建项目成员记录（设置为所有者角色）
        $memberEntity = new ProjectMemberEntity();
        $memberEntity->setProjectId($projectId);
        $memberEntity->setTargetTypeFromString('User');
        $memberEntity->setTargetId($userId);
        $memberEntity->setRole(MemberRole::OWNER);
        $memberEntity->setOrganizationCode($organizationCode);
        $memberEntity->setInvitedBy($userId);

        // 批量插入成员记录
        $this->projectMemberRepository->insert([$memberEntity]);

        // 创建项目成员设置记录（绑定到工作区）
        $this->projectMemberSettingRepository->setProjectShortcut($userId, $projectId, $workspaceId, $organizationCode);
    }
}
