<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WorkspaceEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\WorkspaceModel;
use Hyperf\DbConnection\Db;

class WorkspaceRepository extends AbstractRepository implements WorkspaceRepositoryInterface
{
    public function __construct(protected WorkspaceModel $model)
    {
    }

    /**
     * 获取用户工作区列表.
     */
    public function getUserWorkspaces(string $userId, int $page, int $pageSize): array
    {
        $models = $this->model::query()
            ->where('user_id', $userId)
            ->orderBy('updated_at', 'desc')
            ->offset(($page - 1) * $pageSize)
            ->limit($pageSize)
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->modelToEntity($model);
        }

        return $entities;
    }

    /**
     * 创建工作区.
     */
    public function createWorkspace(WorkspaceEntity $workspaceEntity): WorkspaceEntity
    {
        $model = new $this->model();
        $model->fill($workspaceEntity->toArray());
        $model->save();

        $workspaceEntity->setId($model->id);
        return $workspaceEntity;
    }

    /**
     * 更新工作区.
     */
    public function updateWorkspace(WorkspaceEntity $workspaceEntity): bool
    {
        $model = $this->model::query()->find($workspaceEntity->getId());
        if (! $model) {
            return false;
        }

        return $model->update($workspaceEntity->toArray());
    }

    /**
     * 获取工作区详情.
     */
    public function getWorkspaceById(int $workspaceId): ?WorkspaceEntity
    {
        $model = $this->model::query()->where('id', $workspaceId)->whereNull('deleted_at')->first();
        return $this->modelToEntity($model);
    }

    /**
     * 根据ID查找工作区.
     */
    public function findById(int $workspaceId): ?WorkspaceEntity
    {
        return $this->getWorkspaceById($workspaceId);
    }

    /**
     * 通过会话ID获取工作区.
     */
    public function getWorkspaceByConversationId(string $conversationId): ?WorkspaceEntity
    {
        $model = $this->model::query()->where('conversation_id', $conversationId)->whereNull('deleted_at')->first();
        return $this->modelToEntity($model);
    }

    /**
     * 更新工作区归档状态.
     */
    public function updateWorkspaceArchivedStatus(int $workspaceId, int $isArchived): bool
    {
        return $this->model::query()
            ->where('id', $workspaceId)
            ->update(['is_archived' => $isArchived]) > 0;
    }

    /**
     * 删除工作区.
     */
    public function deleteWorkspace(int $workspaceId): bool
    {
        return $this->model::query()->where('id', $workspaceId)->delete() > 0;
    }

    /**
     * 删除工作区关联的话题.
     */
    public function deleteTopicsByWorkspaceId(int $workspaceId): bool
    {
        // 注意：这里需要根据实际情况实现，比如通过外部服务或者其他Repository删除话题
        // 由于我们没有看到话题表的结构，这里仅作为示例
        return Db::table('magic_chat_topics')
            ->where('workspace_id', $workspaceId)
            ->delete() > 0;
    }

    /**
     * 更新工作区当前话题.
     */
    public function updateWorkspaceCurrentTopic(int $workspaceId, string $topicId): bool
    {
        return $this->model::query()
            ->where('id', $workspaceId)
            ->update(['current_topic_id' => $topicId]) > 0;
    }

    /**
     * 更新工作区状态.
     */
    public function updateWorkspaceStatus(int $workspaceId, int $status): bool
    {
        return $this->model::query()
            ->where('id', $workspaceId)
            ->update(['status' => $status]) > 0;
    }

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
    ): array {
        $query = $this->model::query();

        // 默认过滤已删除的数据
        $query->whereNull('deleted_at');

        // 应用查询条件
        foreach ($conditions as $field => $value) {
            // 默认等于查询
            $query->where($field, $value);
        }

        // 获取总数
        $total = $query->count();

        // 排序和分页
        $list = $query->orderBy($orderBy, $orderDirection)
            ->offset(($page - 1) * $pageSize)
            ->limit($pageSize)
            ->get();

        // 转换为实体对象
        $entities = [];
        foreach ($list as $model) {
            $entities[] = $this->modelToEntity($model);
        }

        return [
            'total' => $total,
            'list' => $entities,
        ];
    }

    /**
     * 保存工作区（创建或更新）.
     *
     * @param WorkspaceEntity $workspaceEntity 工作区实体
     * @return WorkspaceEntity 保存后的工作区实体
     */
    public function save(WorkspaceEntity $workspaceEntity): WorkspaceEntity
    {
        if ($workspaceEntity->getId()) {
            // 更新已存在的工作区
            $model = $this->model::query()->find($workspaceEntity->getId());
            if ($model) {
                $model->update($workspaceEntity->toArray());
            }
        } else {
            // 创建新工作区
            $model = new $this->model();
            $model->fill($workspaceEntity->toArray());
            $model->save();
            $workspaceEntity->setId($model->id);
        }

        return $workspaceEntity;
    }

    /**
     * 获取所有工作区的唯一组织代码列表.
     *
     * @return array 唯一的组织代码列表
     */
    public function getUniqueOrganizationCodes(): array
    {
        return $this->model::query()
            ->whereNull('deleted_at')
            ->distinct()
            ->pluck('user_organization_code')
            ->filter(function ($code) {
                return ! empty($code);
            })
            ->toArray();
    }

    /**
     * 批量获取工作区名称映射.
     *
     * @param array $workspaceIds 工作区ID数组
     * @return array ['workspace_id' => 'workspace_name'] 键值对
     */
    public function getWorkspaceNamesBatch(array $workspaceIds): array
    {
        if (empty($workspaceIds)) {
            return [];
        }

        $results = $this->model::query()
            ->whereIn('id', $workspaceIds)
            ->whereNull('deleted_at')
            ->select(['id', 'name'])
            ->get();

        $workspaceNames = [];
        foreach ($results as $result) {
            $workspaceNames[(string) $result->id] = $result->name;
        }

        return $workspaceNames;
    }

    /**
     * 将模型对象转换为实体对象
     *
     * @param null|WorkspaceModel $model 模型对象
     * @return null|WorkspaceEntity 实体对象
     */
    protected function modelToEntity($model): ?WorkspaceEntity
    {
        if (! $model) {
            return null;
        }

        $entity = new WorkspaceEntity();
        $entity->setId((int) $model->id);
        $entity->setUserId((string) $model->user_id);
        $entity->setUserOrganizationCode((string) $model->user_organization_code);
        $entity->setChatConversationId((string) $model->chat_conversation_id);
        $entity->setName((string) $model->name);
        $entity->setIsArchived((int) $model->is_archived);
        $entity->setCreatedUid((string) $model->created_uid);
        $entity->setUpdatedUid((string) $model->updated_uid);
        $entity->setCreatedAt($model->created_at ? (string) $model->created_at : null);
        $entity->setUpdatedAt($model->updated_at ? (string) $model->updated_at : null);
        $entity->setDeletedAt($model->deleted_at ? (string) $model->deleted_at : null);
        $entity->setCurrentTopicId($model->current_topic_id ? (int) $model->current_topic_id : null);
        $entity->setStatus((int) $model->status);

        return $entity;
    }
}
