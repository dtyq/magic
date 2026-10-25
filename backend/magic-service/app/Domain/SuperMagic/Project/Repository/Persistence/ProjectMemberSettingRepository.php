<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Repository\Persistence;

use App\Domain\SuperMagic\Project\Entity\ProjectMemberSettingEntity;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectMemberSettingRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Model\ProjectMemberSettingModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\DbConnection\Db;
use RuntimeException;

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
            'sort_order' => null,
            'pinned_sort_order' => null,
            'last_active_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        // Keep this method's "create if missing" semantics: on a concurrent
        // conflict, leave the existing personal settings untouched.
        $this->model::query()->upsert([$attributes], ['user_id', 'project_id'], ['project_id']);

        $result = $this->model::query()
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->first();

        if ($result === null) {
            throw new RuntimeException('Failed to create project member setting.');
        }

        return ProjectMemberSettingEntity::modelToEntity($result->toArray());
    }

    /**
     * 创建或更新项目成员设置.
     */
    public function save(ProjectMemberSettingEntity $entity): ProjectMemberSettingEntity
    {
        $attributes = $entity->toInsertArray();
        $attributes['pinned_at'] = $attributes['pinned_at'] ?? null;
        $now = date('Y-m-d H:i:s');

        // 如果实体没有ID，说明是新建
        if ($entity->getId() === 0) {
            $attributes['id'] = IdGenerator::getSnowId();
            $attributes['created_at'] = $now;
            $attributes['updated_at'] = $now;

            // 使用 ON DUPLICATE KEY UPDATE 处理并发情况
            $this->model::query()->upsert(
                [$attributes],
                ['user_id', 'project_id'],
                ['is_pinned', 'pinned_at', 'sort_order', 'pinned_sort_order', 'last_active_at', 'updated_at']
            );

            $stored = $this->model::query()
                ->where('user_id', $attributes['user_id'])
                ->where('project_id', $attributes['project_id'])
                ->first();
            if ($stored !== null) {
                $entity->setId((int) $stored->id);
            }
        } else {
            // 更新现有记录
            $this->model::query()
                ->where('id', $entity->getId())
                ->update([
                    'is_pinned' => $attributes['is_pinned'],
                    'pinned_at' => $attributes['pinned_at'] ?? null,
                    'sort_order' => $attributes['sort_order'] ?? null,
                    'pinned_sort_order' => $attributes['pinned_sort_order'] ?? null,
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
        $organizationCode = Db::table('magic_super_agent_project')
            ->where('id', $projectId)
            ->value('user_organization_code');
        $attributes = [
            'id' => IdGenerator::getSnowId(),
            'user_id' => $userId,
            'project_id' => $projectId,
            'organization_code' => $organizationCode ?: '',
            'is_pinned' => $isPinned ? 1 : 0,
            'pinned_at' => $isPinned ? $now : null,
            'sort_order' => null,
            'pinned_sort_order' => null,
            'is_bind_workspace' => 0,
            'bind_workspace_id' => 0,
            'last_active_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        return $this->model::query()->upsert(
            [$attributes],
            ['user_id', 'project_id'],
            ['is_pinned', 'pinned_at', 'sort_order', 'pinned_sort_order', 'last_active_at', 'updated_at']
        ) >= 0;
    }

    public function updateSortOrder(string $userId, int $projectId, string $organizationCode, ?int $sortOrder): bool
    {
        // Writing the non-pinned segment also makes the segment transition
        // explicit: a project cannot carry an active pinned state and a
        // non-pinned manual position at the same time.
        $now = date('Y-m-d H:i:s');
        $projectCreatedAt = Db::table('magic_super_agent_project')
            ->where('id', $projectId)
            ->value('created_at');
        $attributes = [
            'id' => IdGenerator::getSnowId(),
            'user_id' => $userId,
            'project_id' => $projectId,
            'organization_code' => $organizationCode,
            'is_pinned' => 0,
            'pinned_at' => null,
            'is_bind_workspace' => 0,
            'bind_workspace_id' => 0,
            'sort_order' => $sortOrder,
            'pinned_sort_order' => null,
            'last_active_at' => $projectCreatedAt ?: $now,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        return $this->model::query()->upsert(
            [$attributes],
            ['user_id', 'project_id'],
            ['is_pinned', 'sort_order', 'pinned_sort_order', 'updated_at']
        ) >= 0;
    }

    public function updateSortOrderForMove(string $userId, int $projectId, string $organizationCode, ?int $sortOrder): bool
    {
        $now = date('Y-m-d H:i:s');
        $projectCreatedAt = Db::table('magic_super_agent_project')->where('id', $projectId)->value('created_at');
        $attributes = [
            'id' => IdGenerator::getSnowId(),
            'user_id' => $userId,
            'project_id' => $projectId,
            'organization_code' => $organizationCode,
            'is_pinned' => 0,
            'pinned_at' => null,
            'is_bind_workspace' => 0,
            'bind_workspace_id' => 0,
            'sort_order' => $sortOrder,
            'pinned_sort_order' => null,
            'last_active_at' => $projectCreatedAt ?: $now,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        return $this->model::query()->upsert(
            [$attributes],
            ['user_id', 'project_id'],
            ['sort_order', 'updated_at']
        ) >= 0;
    }

    public function clearManualSortOrders(string $userId, int $projectId): bool
    {
        return $this->model::query()
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->update([
                'sort_order' => null,
                'pinned_sort_order' => null,
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    public function updatePinnedSortOrder(string $userId, int $projectId, string $organizationCode, ?int $sortOrder): bool
    {
        $now = date('Y-m-d H:i:s');
        $existing = $this->model::query()
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->first();
        $projectCreatedAt = Db::table('magic_super_agent_project')
            ->where('id', $projectId)
            ->value('created_at');
        $attributes = [
            'id' => IdGenerator::getSnowId(),
            'user_id' => $userId,
            'project_id' => $projectId,
            'organization_code' => $organizationCode,
            'is_pinned' => 1,
            'pinned_at' => $now,
            'is_bind_workspace' => 0,
            'bind_workspace_id' => 0,
            'sort_order' => null,
            'pinned_sort_order' => $sortOrder,
            'last_active_at' => $projectCreatedAt ?: $now,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $updateColumns = ['is_pinned', 'sort_order', 'pinned_sort_order', 'updated_at'];
        if ($existing !== null && $existing->pinned_at === null) {
            $updateColumns[] = 'pinned_at';
        }

        return $this->model::query()->upsert(
            [$attributes],
            ['user_id', 'project_id'],
            $updateColumns
        ) >= 0;
    }

    public function ensureSettingsForSorting(string $userId, array $projectIds, string $organizationCode): int
    {
        $projectIds = array_values(array_unique(array_map('intval', $projectIds)));
        if ($projectIds === []) {
            return 0;
        }

        $existingProjectIds = $this->model::query()
            ->where('user_id', $userId)
            ->whereIn('project_id', $projectIds)
            ->pluck('project_id')
            ->map(static fn ($id): int => (int) $id)
            ->all();
        $missingProjectIds = array_values(array_diff($projectIds, $existingProjectIds));
        if ($missingProjectIds === []) {
            return 0;
        }

        $now = date('Y-m-d H:i:s');
        $projectCreatedAt = Db::table('magic_super_agent_project')
            ->whereIn('id', $missingProjectIds)
            ->pluck('created_at', 'id')
            ->all();
        $insertData = [];
        foreach ($missingProjectIds as $missingProjectId) {
            $lastActiveAt = $projectCreatedAt[$missingProjectId] ?? $now;
            $insertData[] = [
                'id' => IdGenerator::getSnowId(),
                'user_id' => $userId,
                'project_id' => $missingProjectId,
                'organization_code' => $organizationCode,
                'is_pinned' => 0,
                'pinned_at' => null,
                'is_bind_workspace' => 0,
                'bind_workspace_id' => 0,
                'sort_order' => null,
                'pinned_sort_order' => null,
                // A sorting operation must not make a legacy project look recently used.
                'last_active_at' => $lastActiveAt,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        $this->model::query()->upsert(
            $insertData,
            ['user_id', 'project_id'],
            // Keep sorting initialization idempotent and do not touch the
            // recent-use timestamp when the row already exists.
            ['project_id']
        );

        return count($insertData);
    }

    public function getSortOrderRows(string $userId, ?int $workspaceId = null, ?int $excludeProjectId = null, bool $isPinned = false): array
    {
        $query = $this->model::query()
            ->from($this->model->getTable() . ' as pms')
            ->join('magic_super_agent_project as p', 'p.id', '=', 'pms.project_id')
            ->where('pms.user_id', $userId)
            ->where('pms.is_pinned', $isPinned ? 1 : 0)
            ->whereNull('p.deleted_at')
            ->where('p.is_hidden', 0);
        if ($workspaceId !== null) {
            $query->where('p.workspace_id', $workspaceId);
        }
        if ($excludeProjectId !== null) {
            $query->where('p.id', '<>', $excludeProjectId);
        }

        return $query->select(['p.id', 'pms.sort_order', 'pms.pinned_sort_order', 'pms.pinned_at'])
            ->when($isPinned, function ($query) {
                return $query->orderByRaw('CASE WHEN pms.pinned_sort_order IS NULL THEN 0 ELSE 1 END ASC')
                    ->orderByRaw('CASE WHEN pms.pinned_sort_order IS NULL THEN pms.pinned_at END DESC')
                    ->orderByRaw('CASE WHEN pms.pinned_sort_order IS NULL THEN p.id END DESC')
                    ->orderByRaw('CASE WHEN pms.pinned_sort_order IS NOT NULL THEN pms.pinned_sort_order END ASC');
            }, function ($query) {
                return $query->orderByRaw('CASE WHEN pms.sort_order IS NULL THEN 0 ELSE 1 END ASC')
                    ->orderByRaw('CASE WHEN pms.sort_order IS NULL THEN p.id END DESC')
                    ->orderByRaw('CASE WHEN pms.sort_order IS NOT NULL THEN pms.sort_order END ASC');
            })
            ->lockForUpdate()
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'sort_order' => $row->sort_order !== null ? (int) $row->sort_order : null,
                'pinned_sort_order' => $row->pinned_sort_order !== null ? (int) $row->pinned_sort_order : null,
            ])
            ->all();
    }

    public function batchUpdateSortOrders(string $userId, array $sortOrders): int
    {
        return $this->batchUpdateOrderValues($userId, $sortOrders, false);
    }

    public function batchUpdateSortOrdersForMove(string $userId, array $sortOrders): int
    {
        if ($sortOrders === []) {
            return 0;
        }
        $caseParts = [];
        $projectIds = [];
        foreach ($sortOrders as $projectId => $sortOrder) {
            $projectId = (int) $projectId;
            $projectIds[] = $projectId;
            $caseParts[] = 'WHEN ' . $projectId . ' THEN ' . (int) $sortOrder;
        }
        return (int) $this->model::query()
            ->where('user_id', $userId)
            ->whereIn('project_id', $projectIds)
            ->update([
                'sort_order' => Db::raw('CASE project_id ' . implode(' ', $caseParts) . ' END'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }

    public function batchUpdatePinnedSortOrders(string $userId, array $sortOrders): int
    {
        return $this->batchUpdateOrderValues($userId, $sortOrders, true);
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

        $this->model::query()->upsert(
            [$attributes],
            ['user_id', 'project_id'],
            ['is_bind_workspace', 'bind_workspace_id', 'last_active_at', 'updated_at']
        );
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

    /**
     * Delete setting by user ID and project ID.
     */
    public function deleteByUserAndProject(string $userId, int $projectId): bool
    {
        $deleted = $this->model::query()
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->delete();

        return $deleted > 0;
    }

    /**
     * Batch ensure settings exist for a user across multiple projects.
     * Creates settings if not exist, updates last_active_at if exist.
     *
     * @param string $userId User ID
     * @param array $projectIds Project ID array
     * @param string $organizationCode Organization code
     * @return int Number of affected records
     */
    public function batchEnsureSettings(string $userId, array $projectIds, string $organizationCode): int
    {
        if (empty($projectIds)) {
            return 0;
        }

        $now = date('Y-m-d H:i:s');

        // Get existing settings for this user
        $projectIds = array_values(array_unique(array_map('intval', $projectIds)));
        $upsertData = [];
        foreach ($projectIds as $projectId) {
            $upsertData[] = [
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
        }

        $this->model::query()->upsert(
            $upsertData,
            ['user_id', 'project_id'],
            ['last_active_at', 'updated_at']
        );

        return count($upsertData);
    }

    /**
     * Batch set project shortcuts for a user across multiple projects.
     *
     * @param string $userId User ID
     * @param array $projectWorkspaceBindings Array of [projectId => workspaceId, ...]
     * @param string $organizationCode Organization code
     * @return int Number of affected records
     */
    public function batchSetProjectShortcuts(string $userId, array $projectWorkspaceBindings, string $organizationCode): int
    {
        if (empty($projectWorkspaceBindings)) {
            return 0;
        }

        $now = date('Y-m-d H:i:s');
        $upsertData = [];
        foreach ($projectWorkspaceBindings as $projectId => $workspaceId) {
            $upsertData[] = [
                'id' => IdGenerator::getSnowId(),
                'user_id' => $userId,
                'project_id' => (int) $projectId,
                'organization_code' => $organizationCode,
                'is_pinned' => 0,
                'pinned_at' => null,
                'is_bind_workspace' => 1,
                'bind_workspace_id' => $workspaceId,
                'last_active_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        $this->model::query()->upsert(
            $upsertData,
            ['user_id', 'project_id'],
            ['is_bind_workspace', 'bind_workspace_id', 'last_active_at', 'updated_at']
        );

        return count($upsertData);
    }

    /**
     * Batch cancel project shortcuts for a user across multiple projects.
     */
    public function batchCancelProjectShortcuts(string $userId, array $projectIds): int
    {
        if (empty($projectIds)) {
            return 0;
        }

        $now = date('Y-m-d H:i:s');

        return $this->model::query()
            ->where('user_id', $userId)
            ->whereIn('project_id', $projectIds)
            ->update([
                'is_bind_workspace' => 0,
                'bind_workspace_id' => 0,
                'last_active_at' => $now,
                'updated_at' => $now,
            ]);
    }

    /**
     * Batch delete settings for a user across multiple projects.
     *
     * @param string $userId User ID
     * @param array $projectIds Project ID array
     * @return int Number of deleted records
     */
    public function batchDeleteByUserAndProjects(string $userId, array $projectIds): int
    {
        if (empty($projectIds)) {
            return 0;
        }

        return $this->model::query()
            ->where('user_id', $userId)
            ->whereIn('project_id', $projectIds)
            ->delete();
    }

    /**
     * Update a complete ordering segment in one SQL statement. Reordering a
     * large collaboration list must not issue one UPDATE per project.
     */
    private function batchUpdateOrderValues(string $userId, array $sortOrders, bool $pinned): int
    {
        if ($sortOrders === []) {
            return 0;
        }

        $normalized = [];
        foreach ($sortOrders as $projectId => $sortOrder) {
            $normalized[(int) $projectId] = (int) $sortOrder;
        }
        $caseParts = [];
        foreach ($normalized as $projectId => $sortOrder) {
            $caseParts[] = 'WHEN ' . $projectId . ' THEN ' . $sortOrder;
        }
        $caseExpression = 'CASE project_id ' . implode(' ', $caseParts) . ' END';
        $projectIds = array_keys($normalized);

        $attributes = $pinned
            ? [
                'is_pinned' => 1,
                'pinned_at' => Db::raw("COALESCE(pinned_at, '" . date('Y-m-d H:i:s') . "')"),
                'sort_order' => null,
                'pinned_sort_order' => Db::raw($caseExpression),
            ]
            : [
                'is_pinned' => 0,
                'pinned_at' => null,
                'sort_order' => Db::raw($caseExpression),
                'pinned_sort_order' => null,
            ];

        return (int) $this->model::query()
            ->where('user_id', $userId)
            ->whereIn('project_id', $projectIds)
            ->update($attributes);
    }
}
