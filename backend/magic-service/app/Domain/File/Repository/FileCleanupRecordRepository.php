<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Repository;

use App\Domain\File\Entity\FileCleanupRecordEntity;
use App\Domain\File\Repository\Model\FileCleanupRecordModel;
use Hyperf\Database\Model\Collection;
use Hyperf\DbConnection\Db;

class FileCleanupRecordRepository
{
    /**
     * 创建文件清理记录.
     */
    public function create(FileCleanupRecordEntity $entity): FileCleanupRecordEntity
    {
        /** @var FileCleanupRecordModel $model */
        $model = FileCleanupRecordModel::query()->create([
            'organization_code' => $entity->getOrganizationCode(),
            'file_key' => $entity->getFileKey(),
            'file_name' => $entity->getFileName(),
            'file_size' => $entity->getFileSize(),
            'bucket_type' => $entity->getBucketType(),
            'source_type' => $entity->getSourceType(),
            'source_id' => $entity->getSourceId(),
            'expire_at' => $entity->getExpireAt(),
            'status' => $entity->getStatus(),
            'retry_count' => $entity->getRetryCount(),
            'error_message' => $entity->getErrorMessage(),
        ]);

        $entity->setId($model->id);
        $entity->setCreatedAt($model->created_at);
        $entity->setUpdatedAt($model->updated_at);

        return $entity;
    }

    /**
     * 根据ID查找记录.
     */
    public function findById(int $id): ?FileCleanupRecordEntity
    {
        /** @var ?FileCleanupRecordModel $model */
        $model = FileCleanupRecordModel::query()->find($id);

        return $model ? $this->modelToEntity($model) : null;
    }

    /**
     * 根据文件key和组织编码查找记录.
     */
    public function findByFileKey(string $fileKey, string $organizationCode): ?FileCleanupRecordEntity
    {
        /** @var ?FileCleanupRecordModel $model */
        $model = FileCleanupRecordModel::query()
            ->where('file_key', $fileKey)
            ->where('organization_code', $organizationCode)
            ->first();

        return $model ? $this->modelToEntity($model) : null;
    }

    /**
     * 获取过期的待清理记录.
     */
    public function getExpiredRecords(int $limit = 50): array
    {
        /** @var Collection<FileCleanupRecordModel> $models */
        $models = FileCleanupRecordModel::query()
            ->where('expire_at', '<=', date('Y-m-d H:i:s'))
            ->where('status', 0) // 待清理状态
            ->orderBy('expire_at', 'asc')
            ->limit($limit)
            ->get();

        return $this->modelsToEntities($models);
    }

    /**
     * 获取需要重试的失败记录.
     */
    public function getRetryRecords(int $maxRetries = 3, int $limit = 50): array
    {
        /** @var Collection<FileCleanupRecordModel> $models */
        $models = FileCleanupRecordModel::query()
            ->where('status', 2) // 失败状态
            ->where('retry_count', '<', $maxRetries)
            ->where('updated_at', '<=', date('Y-m-d H:i:s', time() - 300)) // 5分钟前更新的记录
            ->orderBy('updated_at', 'asc')
            ->limit($limit)
            ->get();

        return $this->modelsToEntities($models);
    }

    /**
     * 更新记录状态.
     */
    public function updateStatus(int $id, int $status, ?string $errorMessage = null): bool
    {
        $updateData = [
            'status' => $status,
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if ($errorMessage !== null) {
            $updateData['error_message'] = $errorMessage;
        }

        return FileCleanupRecordModel::query()
            ->where('id', $id)
            ->update($updateData) > 0;
    }

    /**
     * 增加重试次数.
     */
    public function incrementRetry(int $id, ?string $errorMessage = null): bool
    {
        $updateData = [
            'retry_count' => Db::raw('retry_count + 1'),
            'status' => 2, // 设置为失败状态
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if ($errorMessage !== null) {
            $updateData['error_message'] = $errorMessage;
        }

        return FileCleanupRecordModel::query()
            ->where('id', $id)
            ->update($updateData) > 0;
    }

    /**
     * 删除记录.
     */
    public function delete(int $id): bool
    {
        return FileCleanupRecordModel::query()
            ->where('id', $id)
            ->delete() > 0;
    }

    /**
     * 批量删除记录.
     */
    public function batchDelete(array $ids): bool
    {
        return FileCleanupRecordModel::query()
            ->whereIn('id', $ids)
            ->delete() > 0;
    }

    /**
     * 取消清理(如果文件需要保留).
     */
    public function cancelCleanup(string $fileKey, string $organizationCode): bool
    {
        return FileCleanupRecordModel::query()
            ->where('file_key', $fileKey)
            ->where('organization_code', $organizationCode)
            ->where('status', 0) // 只能取消待清理状态的记录
            ->delete() > 0;
    }

    /**
     * 获取清理统计数据.
     */
    public function getCleanupStats(?string $sourceType = null): array
    {
        $query = FileCleanupRecordModel::query();

        if ($sourceType) {
            $query->where('source_type', $sourceType);
        }

        $pending = (clone $query)->where('status', 0)->count();
        $cleaned = (clone $query)->where('status', 1)->count();
        $failed = (clone $query)->where('status', 2)->count();
        $expired = (clone $query)->where('status', 0)->where('expire_at', '<=', date('Y-m-d H:i:s'))->count();

        return [
            'pending' => $pending,
            'cleaned' => $cleaned,
            'failed' => $failed,
            'expired' => $expired,
            'total' => $pending + $cleaned + $failed,
        ];
    }

    /**
     * 清理旧的成功记录.
     */
    public function cleanupOldRecords(int $daysToKeep = 7): int
    {
        $cutoffDate = date('Y-m-d H:i:s', time() - ($daysToKeep * 24 * 3600));

        return FileCleanupRecordModel::query()
            ->where('status', 1) // 只清理已成功的记录
            ->where('updated_at', '<', $cutoffDate)
            ->delete();
    }

    /**
     * 清理长时间失败的记录.
     */
    public function cleanupFailedRecords(int $maxRetries = 3, int $daysToKeep = 7): int
    {
        $cutoffDate = date('Y-m-d H:i:s', time() - ($daysToKeep * 24 * 3600));

        return FileCleanupRecordModel::query()
            ->where('status', 2) // 失败状态
            ->where('retry_count', '>=', $maxRetries)
            ->where('updated_at', '<', $cutoffDate)
            ->delete();
    }

    /**
     * 将Model转换为Entity.
     */
    private function modelToEntity(FileCleanupRecordModel $model): FileCleanupRecordEntity
    {
        $entity = new FileCleanupRecordEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setFileKey($model->file_key);
        $entity->setFileName($model->file_name);
        $entity->setFileSize($model->file_size);
        $entity->setBucketType($model->bucket_type);
        $entity->setSourceType($model->source_type);
        $entity->setSourceId($model->source_id);
        $entity->setExpireAt($model->expire_at);
        $entity->setStatus($model->status);
        $entity->setRetryCount($model->retry_count);
        $entity->setErrorMessage($model->error_message);
        $entity->setCreatedAt($model->created_at);
        $entity->setUpdatedAt($model->updated_at);

        return $entity;
    }

    /**
     * 将多个Model转换为Entity数组.
     */
    private function modelsToEntities(Collection $models): array
    {
        $entities = [];
        /** @var FileCleanupRecordModel $model */
        foreach ($models as $model) {
            $entities[] = $this->modelToEntity($model);
        }
        return $entities;
    }
}
