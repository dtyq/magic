<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WorkspaceEntity;

interface WorkspaceRepositoryInterface
{
    /**
     * 获取用户工作区列表.
     */
    public function getUserWorkspaces(string $userId, int $page, int $pageSize): array;

    /**
     * 创建工作区.
     */
    public function createWorkspace(WorkspaceEntity $workspaceEntity): WorkspaceEntity;

    /**
     * 更新工作区.
     */
    public function updateWorkspace(WorkspaceEntity $workspaceEntity): bool;

    /**
     * 获取工作区详情.
     */
    public function getWorkspaceById(int $workspaceId): ?WorkspaceEntity;

    /**
     * 根据ID查找工作区.
     */
    public function findById(int $workspaceId): ?WorkspaceEntity;

    /**
     * 通过会话ID获取工作区.
     */
    public function getWorkspaceByConversationId(string $conversationId): ?WorkspaceEntity;

    /**
     * 更新工作区归档状态.
     */
    public function updateWorkspaceArchivedStatus(int $workspaceId, int $isArchived): bool;

    /**
     * 删除工作区.
     */
    public function deleteWorkspace(int $workspaceId): bool;

    /**
     * 删除工作区关联的话题.
     */
    public function deleteTopicsByWorkspaceId(int $workspaceId): bool;

    /**
     * 更新工作区当前话题.
     */
    public function updateWorkspaceCurrentTopic(int $workspaceId, string $topicId): bool;

    /**
     * 更新工作区状态.
     */
    public function updateWorkspaceStatus(int $workspaceId, int $status): bool;

    /**
     * 根据条件获取工作区列表
     * 支持分页和排序.
     *
     * @param array $conditions 查询条件
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @param string $orderBy 排序字段
     * @param string $orderDirection 排序方向
     * @return array [total, list] 总数和工作区列表
     */
    public function getWorkspacesByConditions(
        array $conditions = [],
        int $page = 1,
        int $pageSize = 10,
        string $orderBy = 'id',
        string $orderDirection = 'asc'
    ): array;

    /**
     * 保存工作区（创建或更新）.
     *
     * @param WorkspaceEntity $workspaceEntity 工作区实体
     * @return WorkspaceEntity 保存后的工作区实体
     */
    public function save(WorkspaceEntity $workspaceEntity): WorkspaceEntity;

    /**
     * 获取所有工作区的唯一组织代码列表.
     *
     * @return array 唯一的组织代码列表
     */
    public function getUniqueOrganizationCodes(): array;

    /**
     * 批量获取工作区名称映射.
     *
     * @param array $workspaceIds 工作区ID数组
     * @return array ['workspace_id' => 'workspace_name'] 键值对
     */
    public function getWorkspaceNamesBatch(array $workspaceIds): array;
}
