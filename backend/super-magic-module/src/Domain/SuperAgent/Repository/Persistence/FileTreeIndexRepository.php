<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\FileTreeIndexEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\FileTreeIndexRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\FileTreeIndexModel;
use Hyperf\DbConnection\Db;

class FileTreeIndexRepository implements FileTreeIndexRepositoryInterface
{
    public function __construct(protected FileTreeIndexModel $model)
    {
    }

    public function insert(FileTreeIndexEntity $entity): FileTreeIndexEntity
    {
        // 将 Entity 转换为数组
        $data = $entity->toArray();
        // 移除 id 字段（自增）
        unset($data['id']);
        // 插入数据库
        $model = $this->model::query()->create($data);
        // 返回包含 id 的 Entity
        return new FileTreeIndexEntity($model->toArray());
    }

    public function batchInsert(array $data): bool
    {
        // 检查数据是否为空
        if (empty($data)) {
            return true;
        }
        // 使用 Db::table()->insert() 批量插入
        // 每条记录需要包含 created_at 和 updated_at
        $now = date('Y-m-d H:i:s');
        foreach ($data as &$item) {
            $item['created_at'] = $now;
            $item['updated_at'] = $now;
        }
        return Db::table('magic_super_agent_file_tree_indexes')->insert($data);
    }

    public function createNodeIndexes(int $nodeId, ?int $parentId, string $organizationCode): void
    {
        // 已存在的 ancestor 关系（用于幂等补全，避免唯一键冲突）
        $existingAncestorIds = $this->model::query()
            ->where('descendant_id', $nodeId)
            ->where('organization_code', $organizationCode)
            ->pluck('ancestor_id')
            ->toArray();
        $existingAncestorMap = array_flip($existingAncestorIds);

        // 准备需要新增的数据
        $data = [];
        $now = date('Y-m-d H:i:s');

        // 1. 节点到自己的记录（distance=0）
        if (! isset($existingAncestorMap[$nodeId])) {
            $data[] = [
                'ancestor_id' => $nodeId,
                'descendant_id' => $nodeId,
                'distance' => 0,
                'organization_code' => $organizationCode,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        // 2. 如果有父节点，补齐父链到当前节点的关系
        if ($parentId !== null) {
            $parentAncestors = $this->model::query()
                ->where('descendant_id', $parentId)
                ->where('organization_code', $organizationCode)
                ->get(['ancestor_id', 'distance']);

            foreach ($parentAncestors as $ancestor) {
                if (isset($existingAncestorMap[$ancestor->ancestor_id])) {
                    continue;
                }

                $data[] = [
                    'ancestor_id' => $ancestor->ancestor_id,
                    'descendant_id' => $nodeId,
                    'distance' => $ancestor->distance + 1,
                    'organization_code' => $organizationCode,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        // 3. 批量插入新增关系
        if (! empty($data)) {
            $this->batchInsert($data);
        }
    }

    public function moveNode(int $nodeId, ?int $oldParentId, ?int $newParentId, string $organizationCode): void
    {
        // 1. 查询要移动的节点及其所有子孙节点（包括软删除节点，因为移动时需要更新所有关系）
        $descendantIds = $this->getDescendantIds($nodeId, $organizationCode, null, true);
        $descendantIds[] = $nodeId; // 包含节点自己

        // 2. 删除旧的祖先关系（不包括子树内部的关系）
        // 删除条件：ancestor 不在子树中，但 descendant 在子树中
        $this->model::query()
            ->whereIn('descendant_id', $descendantIds)
            ->whereNotIn('ancestor_id', $descendantIds)
            ->where('organization_code', $organizationCode)
            ->delete();

        // 3. 创建新的祖先关系
        if ($newParentId !== null) {
            // 查询新父节点的所有祖先（包括新父节点自己）
            $newAncestors = $this->model::query()
                ->where('descendant_id', $newParentId)
                ->where('organization_code', $organizationCode)
                ->get(['ancestor_id', 'distance']);

            // 查询子树的内部关系（用于计算新距离）
            $subtreeRelations = $this->model::query()
                ->where('ancestor_id', $nodeId)
                ->where('organization_code', $organizationCode)
                ->get(['descendant_id', 'distance']);

            // 为子树中的每个节点创建到新祖先的记录
            $data = [];
            $now = date('Y-m-d H:i:s');
            foreach ($newAncestors as $ancestor) {
                foreach ($subtreeRelations as $subtree) {
                    $data[] = [
                        'ancestor_id' => $ancestor->ancestor_id,
                        'descendant_id' => $subtree->descendant_id,
                        'distance' => $ancestor->distance + 1 + $subtree->distance,
                        'organization_code' => $organizationCode,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }

            // 批量插入
            if (! empty($data)) {
                $this->batchInsert($data);
            }
        }
    }

    public function deleteNodeIndexes(int $nodeId, string $organizationCode): void
    {
        // 1. 查询要删除的节点及其所有子孙节点（包括软删除节点，因为物理删除时需要清理所有闭包表记录）
        $descendantIds = $this->getDescendantIds($nodeId, $organizationCode, null, true);
        $descendantIds[] = $nodeId; // 包含节点自己

        // 2. 删除所有相关的闭包表记录
        // 删除条件：descendant 或 ancestor 在要删除的节点列表中
        $this->model::query()
            ->where(function ($query) use ($descendantIds) {
                $query->whereIn('ancestor_id', $descendantIds)
                    ->orWhereIn('descendant_id', $descendantIds);
            })
            ->where('organization_code', $organizationCode)
            ->delete();
    }

    public function getDescendantIds(int $nodeId, string $organizationCode, ?int $maxDistance = null, bool $includeSoftDeleted = false): array
    {
        // 查询所有子孙节点（不包括自己，distance > 0）
        $query = $this->model::query();

        // 是否需要过滤软删除节点
        if (! $includeSoftDeleted) {
            // JOIN task_files 表过滤软删除节点（注意：主键是 file_id 不是 id）
            $query->join('magic_super_agent_task_files', 'magic_super_agent_file_tree_indexes.descendant_id', '=', 'magic_super_agent_task_files.file_id')
                ->whereNull('magic_super_agent_task_files.deleted_at');
        }

        $query->where('magic_super_agent_file_tree_indexes.ancestor_id', $nodeId)
            ->where('magic_super_agent_file_tree_indexes.distance', '>', 0)
            ->where('magic_super_agent_file_tree_indexes.organization_code', $organizationCode);

        // 如果指定了最大距离
        if ($maxDistance !== null) {
            $query->where('magic_super_agent_file_tree_indexes.distance', '<=', $maxDistance);
        }

        // 返回 descendant_id 数组
        return $query->pluck('magic_super_agent_file_tree_indexes.descendant_id')->toArray();
    }

    public function getAncestorIds(int $nodeId, string $organizationCode, bool $includeSoftDeleted = false): array
    {
        $result = $this->batchGetAncestorIds([$nodeId], $organizationCode, $includeSoftDeleted);
        return $result[$nodeId] ?? [];
    }

    public function batchGetAncestorIds(array $nodeIds, string $organizationCode, bool $includeSoftDeleted = false): array
    {
        if (empty($nodeIds)) {
            return [];
        }

        // 查询所有祖先节点（不包括自己，distance > 0）
        $query = $this->model::query();

        // 是否需要过滤软删除节点
        if (! $includeSoftDeleted) {
            // JOIN task_files 表过滤软删除节点（注意：主键是 file_id 不是 id）
            $query->join('magic_super_agent_task_files', 'magic_super_agent_file_tree_indexes.ancestor_id', '=', 'magic_super_agent_task_files.file_id')
                ->whereNull('magic_super_agent_task_files.deleted_at');
        }

        // 批量查询多个节点的祖先
        $results = $query->whereIn('magic_super_agent_file_tree_indexes.descendant_id', $nodeIds)
            ->where('magic_super_agent_file_tree_indexes.distance', '>', 0)
            ->where('magic_super_agent_file_tree_indexes.organization_code', $organizationCode)
            ->select(['magic_super_agent_file_tree_indexes.descendant_id', 'magic_super_agent_file_tree_indexes.ancestor_id'])
            ->get();

        // 按 descendant_id 分组
        $ancestorMap = [];
        foreach ($results as $row) {
            $descendantId = $row['descendant_id'];
            $ancestorId = $row['ancestor_id'];

            if (! isset($ancestorMap[$descendantId])) {
                $ancestorMap[$descendantId] = [];
            }
            $ancestorMap[$descendantId][] = $ancestorId;
        }

        return $ancestorMap;
    }

    public function getAllAncestorIdsFlattened(array $nodeIds, string $organizationCode, bool $includeSoftDeleted = false, bool $includeInputNodes = true): array
    {
        if (empty($nodeIds)) {
            return [];
        }

        // 查询所有祖先节点（不包括自己，distance > 0）
        $query = $this->model::query();

        // 是否需要过滤软删除节点
        if (! $includeSoftDeleted) {
            // JOIN task_files 表过滤软删除节点（注意：主键是 file_id 不是 id）
            $query->join('magic_super_agent_task_files', 'magic_super_agent_file_tree_indexes.ancestor_id', '=', 'magic_super_agent_task_files.file_id')
                ->whereNull('magic_super_agent_task_files.deleted_at');
        }

        // 批量查询多个节点的祖先，使用 distinct 去重
        $ancestorIds = $query->whereIn('magic_super_agent_file_tree_indexes.descendant_id', $nodeIds)
            ->where('magic_super_agent_file_tree_indexes.distance', '>', 0)
            ->where('magic_super_agent_file_tree_indexes.organization_code', $organizationCode)
            ->distinct()
            ->pluck('magic_super_agent_file_tree_indexes.ancestor_id')
            ->toArray();

        // 如果需要包含输入节点本身，合并并去重
        if ($includeInputNodes) {
            $ancestorIds = array_unique(array_merge($ancestorIds, $nodeIds));
        }

        return $ancestorIds;
    }

    public function getDirectChildrenIds(int $nodeId, string $organizationCode, bool $includeSoftDeleted = false): array
    {
        // 查询直接子节点（distance = 1）
        $query = $this->model::query();

        // 是否需要过滤软删除节点
        if (! $includeSoftDeleted) {
            // JOIN task_files 表过滤软删除节点（注意：主键是 file_id 不是 id）
            $query->join('magic_super_agent_task_files', 'magic_super_agent_file_tree_indexes.descendant_id', '=', 'magic_super_agent_task_files.file_id')
                ->whereNull('magic_super_agent_task_files.deleted_at');
        }

        return $query->where('magic_super_agent_file_tree_indexes.ancestor_id', $nodeId)
            ->where('magic_super_agent_file_tree_indexes.distance', 1)
            ->where('magic_super_agent_file_tree_indexes.organization_code', $organizationCode)
            ->pluck('magic_super_agent_file_tree_indexes.descendant_id')
            ->toArray();
    }

    public function isAncestor(int $ancestorId, int $descendantId, string $organizationCode): bool
    {
        // 查询是否存在祖先-后代关系
        // JOIN task_files 表确保两个节点都未被软删除（注意：主键是 file_id 不是 id）
        return $this->model::query()
            ->join('magic_super_agent_task_files as ancestor_file', 'magic_super_agent_file_tree_indexes.ancestor_id', '=', 'ancestor_file.file_id')
            ->join('magic_super_agent_task_files as descendant_file', 'magic_super_agent_file_tree_indexes.descendant_id', '=', 'descendant_file.file_id')
            ->where('magic_super_agent_file_tree_indexes.ancestor_id', $ancestorId)
            ->where('magic_super_agent_file_tree_indexes.descendant_id', $descendantId)
            ->where('magic_super_agent_file_tree_indexes.distance', '>', 0) // 不包括自己
            ->where('magic_super_agent_file_tree_indexes.organization_code', $organizationCode)
            ->whereNull('ancestor_file.deleted_at') // 祖先节点未软删除
            ->whereNull('descendant_file.deleted_at') // 后代节点未软删除
            ->exists();
    }
}
