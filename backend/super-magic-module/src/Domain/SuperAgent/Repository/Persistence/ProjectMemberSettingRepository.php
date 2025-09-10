<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectMemberSettingEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectMemberSettingRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\ProjectMemberSettingModel;

/**
 * 项目成员设置仓储实现.
 *
 * 负责项目成员设置的数据持久化操作
 */
class ProjectMemberSettingRepository implements ProjectMemberSettingRepositoryInterface
{
    public function __construct(
        private readonly ProjectMemberSettingModel $model
    ) {
    }

    /**
     * 根据用户ID和项目ID查找设置.
     */
    public function findByUserAndProject(string $userId, int $projectId): ?ProjectMemberSettingEntity
    {
        $result = $this->model::query()
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->first();

        if (! $result) {
            return null;
        }

        return ProjectMemberSettingEntity::modelToEntity($result->toArray());
    }

    /**
     * 创建项目成员设置.
     */
    public function create(string $userId, int $projectId, string $organizationCode): ProjectMemberSettingEntity
    {
        $now = date('Y-m-d H:i:s');
        $attributes = [
            'id' => IdGenerator::getSnowId(),
            'user_id' => $userId,
            'project_id' => $projectId,
            'organization_code' => $organizationCode,
            'is_pinned' => 0,
            'pinned_at' => null,
            'last_active_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $this->model::query()->create($attributes);

        return ProjectMemberSettingEntity::modelToEntity($attributes);
    }

    /**
     * 创建或更新项目成员设置.
     */
    public function save(ProjectMemberSettingEntity $entity): ProjectMemberSettingEntity
    {
        $attributes = $entity->toInsertArray();
        $now = date('Y-m-d H:i:s');

        // 如果实体没有ID，说明是新建
        if ($entity->getId() === 0) {
            $attributes['id'] = IdGenerator::getSnowId();
            $attributes['created_at'] = $now;
            $attributes['updated_at'] = $now;

            // 使用 ON DUPLICATE KEY UPDATE 处理并发情况
            $this->model::query()->insertOrUpdate($attributes, [
                'is_pinned' => $attributes['is_pinned'],
                'pinned_at' => $attributes['pinned_at'] ?? null,
                'last_active_at' => $attributes['last_active_at'],
                'updated_at' => $now,
            ]);

            $entity->setId($attributes['id']);
        } else {
            // 更新现有记录
            $this->model::query()
                ->where('id', $entity->getId())
                ->update([
                    'is_pinned' => $attributes['is_pinned'],
                    'pinned_at' => $attributes['pinned_at'] ?? null,
                    'last_active_at' => $attributes['last_active_at'],
                    'updated_at' => $now,
                ]);
        }

        return $entity;
    }

    /**
     * 更新置顶状态（假设记录已存在）.
     */
    public function updatePinStatus(string $userId, int $projectId, bool $isPinned): bool
    {
        $now = date('Y-m-d H:i:s');
        $attributes = [
            'is_pinned' => $isPinned ? 1 : 0,
            'pinned_at' => $isPinned ? $now : null,
            'last_active_at' => $now,
            'updated_at' => $now,
        ];

        // 更新现有记录
        $updated = $this->model::query()
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->update($attributes);

        return $updated > 0;
    }

    /**
     * 批量获取用户的置顶项目ID列表.
     */
    public function getPinnedProjectIds(string $userId, string $organizationCode): array
    {
        $results = $this->model::query()
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->where('is_pinned', 1)
            ->orderBy('pinned_at', 'desc')
            ->pluck('project_id')
            ->toArray();

        return array_map(fn ($id) => (int) $id, $results);
    }

    /**
     * 批量获取用户在多个项目的设置.
     */
    public function findByUserAndProjects(string $userId, array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        $results = $this->model::query()
            ->where('user_id', $userId)
            ->whereIn('project_id', $projectIds)
            ->get()
            ->keyBy('project_id')
            ->toArray();

        $entities = [];
        foreach ($results as $projectId => $data) {
            $entities[(int) $projectId] = ProjectMemberSettingEntity::modelToEntity($data);
        }

        return $entities;
    }

    /**
     * 更新最后活跃时间.
     */
    public function updateLastActiveTime(string $userId, int $projectId): bool
    {
        $now = date('Y-m-d H:i:s');
        $attributes = [
            'last_active_at' => $now,
        ];

        return (bool) $this->model::query()
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->update($attributes);
    }

    /**
     * 删除项目相关的所有设置.
     */
    public function deleteByProjectId(int $projectId): int
    {
        return $this->model::query()
            ->where('project_id', $projectId)
            ->delete();
    }

    /**
     * 删除用户相关的所有设置.
     */
    public function deleteByUser(string $userId, string $organizationCode): int
    {
        return $this->model::query()
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->delete();
    }

    /**
     * 设置项目快捷方式（绑定到工作区）.
     */
    public function setProjectShortcut(string $userId, int $projectId, int $workspaceId, string $organizationCode): bool
    {
        $now = date('Y-m-d H:i:s');

        // 检查记录是否存在
        $existing = $this->model::query()
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->first();

        if ($existing) {
            // 更新现有记录
            return (bool) $this->model::query()
                ->where('user_id', $userId)
                ->where('project_id', $projectId)
                ->update([
                    'is_bind_workspace' => 1,
                    'bind_workspace_id' => $workspaceId,
                    'last_active_at' => $now,
                    'updated_at' => $now,
                ]);
        }
        // 创建新记录
        $attributes = [
            'id' => IdGenerator::getSnowId(),
            'user_id' => $userId,
            'project_id' => $projectId,
            'organization_code' => $organizationCode,
            'is_pinned' => 0,
            'pinned_at' => null,
            'is_bind_workspace' => 1,
            'bind_workspace_id' => $workspaceId,
            'last_active_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $this->model::query()->create($attributes);
        return true;
    }

    /**
     * 取消项目快捷方式（取消工作区绑定）.
     */
    public function cancelProjectShortcut(string $userId, int $projectId): bool
    {
        $now = date('Y-m-d H:i:s');

        return (bool) $this->model::query()
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->update([
                'is_bind_workspace' => 0,
                'bind_workspace_id' => 0,
                'last_active_at' => $now,
                'updated_at' => $now,
            ]);
    }

    /**
     * 检查项目是否已设置快捷方式.
     */
    public function hasProjectShortcut(string $userId, int $projectId, int $workspaceId): bool
    {
        return $this->model::query()
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->where('is_bind_workspace', 1)
            ->where('bind_workspace_id', $workspaceId)
            ->exists();
    }
}
