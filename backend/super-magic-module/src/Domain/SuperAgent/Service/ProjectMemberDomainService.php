<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectMemberEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectMemberRepositoryInterface;
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
    ) {
    }

    /**
     * 更新项目成员 - 主业务方法
     *
     * @param string $organizationCode 组织编码
     * @param int $projectId 项目ID
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
            if (!empty($memberEntities)) {
                $this->projectMemberRepository->insert($memberEntities);
            }
        });
    }

    /**
     * 检查用户是否为项目的用户级成员
     */
    public function isProjectMemberByUser(int $projectId, string $userId): bool
    {
        return $this->projectMemberRepository->existsByProjectAndUser($projectId, $userId);
    }

    /**
     * 检查用户是否为项目的部门级成员
     */
    public function isProjectMemberByDepartments(int $projectId, array $departmentIds): bool
    {
        return $this->projectMemberRepository->existsByProjectAndDepartments($projectId, $departmentIds);
    }

    /**
     * 根据项目ID获取项目成员列表
     *
     * @param int $projectId 项目ID
     * @return ProjectMemberEntity[] 项目成员实体数组
     */
    public function getProjectMembers(int $projectId): array
    {
        return $this->projectMemberRepository->findByProjectId($projectId);
    }

    /**
     * 根据用户和部门获取项目ID列表
     *
     */
    public function deleteByProjectId(int $projectId): bool
    {
        return (bool) $this->projectMemberRepository->deleteByProjectId($projectId);
    }

    /**
     * 根据用户和部门获取项目ID列表及总数
     *
     * @param string $userId 用户ID
     * @param array $departmentIds 部门ID数组
     * @return array ['total' => int, 'project_ids' => array]
     */
    public function getProjectIdsByUserAndDepartmentsWithTotal(string $userId, array $departmentIds = []): array
    {
        return $this->projectMemberRepository->getProjectIdsByUserAndDepartments($userId, $departmentIds);
    }

    /**
     * 批量获取项目成员总数
     *
     * @param array $projectIds 项目ID数组
     * @return array [project_id => total_count]
     */
    public function getProjectMembersCounts(array $projectIds): array
    {
        return $this->projectMemberRepository->getProjectMembersCounts($projectIds);
    }

    /**
     * 批量获取项目前N个成员预览
     *
     * @param array $projectIds 项目ID数组
     * @param int $limit 限制数量，默认4个
     * @return ProjectMemberEntity[][]
     */
    public function getProjectMembersPreview(array $projectIds, int $limit = 4): array
    {
        return $this->projectMemberRepository->getProjectMembersPreview($projectIds, $limit);
    }
}
