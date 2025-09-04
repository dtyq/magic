<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileVersionEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileVersionRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TaskFileVersionModel;

class TaskFileVersionRepository implements TaskFileVersionRepositoryInterface
{
    public function __construct(protected TaskFileVersionModel $model)
    {
    }

    public function getById(int $id): ?TaskFileVersionEntity
    {
        $model = $this->model::query()->where('id', $id)->first();
        if (! $model) {
            return null;
        }
        return new TaskFileVersionEntity($model->toArray());
    }

    public function getByFileId(int $fileId): array
    {
        $models = $this->model::query()
            ->where('file_id', $fileId)
            ->orderBy('version', 'desc')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = new TaskFileVersionEntity($model->toArray());
        }

        return $entities;
    }

    public function countByFileId(int $fileId): int
    {
        return $this->model::query()
            ->where('file_id', $fileId)
            ->count();
    }

    public function getLatestVersionNumber(int $fileId): int
    {
        $latestVersion = $this->model::query()
            ->where('file_id', $fileId)
            ->max('version');

        return $latestVersion ?? 0;
    }

    public function insert(TaskFileVersionEntity $entity): TaskFileVersionEntity
    {
        $date = date('Y-m-d H:i:s');
        $entity->setCreatedAt($date);
        $entity->setUpdatedAt($date);

        $entityArray = $entity->toArray();
        $model = $this->model::query()->create($entityArray);

        if (! empty($model->id)) {
            $entity->setId($model->id);
        }

        return $entity;
    }

    public function deleteOldVersionsByFileId(int $fileId, int $keepCount): int
    {
        // 获取需要删除的版本ID列表（保留最新的keepCount个版本）
        $versionsToDelete = $this->model::query()
            ->where('file_id', $fileId)
            ->orderBy('version', 'desc')
            ->skip($keepCount)  // 跳过最新的keepCount个版本
            ->pluck('id')
            ->toArray();

        if (empty($versionsToDelete)) {
            return 0;
        }

        // 批量删除旧版本
        return $this->model::query()
            ->whereIn('id', $versionsToDelete)
            ->delete();
    }

    public function deleteAllVersionsByFileId(int $fileId): int
    {
        return $this->model::query()
            ->where('file_id', $fileId)
            ->delete();
    }

    /**
     * 获取需要清理的版本实体列表.
     */
    public function getVersionsToCleanup(int $fileId, int $keepCount): array
    {
        $models = $this->model::query()
            ->where('file_id', $fileId)
            ->orderBy('version', 'desc')
            ->skip($keepCount)
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = new TaskFileVersionEntity($model->toArray());
        }

        return $entities;
    }

    /**
     * 分页获取指定文件的版本列表，按版本号倒序.
     */
    public function getByFileIdWithPage(int $fileId, int $page, int $pageSize): array
    {
        $query = $this->model::query()->where('file_id', $fileId);

        // 获取总数
        $total = $query->count();

        // 分页查询
        $models = $query->orderBy('version', 'desc')
            ->skip(($page - 1) * $pageSize)
            ->take($pageSize)
            ->get();

        // 转换为实体
        $entities = [];
        foreach ($models as $model) {
            $entities[] = new TaskFileVersionEntity($model->toArray());
        }

        return [
            'list' => $entities,
            'total' => $total,
        ];
    }
}
