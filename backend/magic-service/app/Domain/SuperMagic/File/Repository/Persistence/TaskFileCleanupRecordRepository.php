<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Repository\Persistence;

use App\Domain\SuperMagic\File\Entity\TaskFileCleanupRecordEntity;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileCleanupRecordRepositoryInterface;
use App\Domain\SuperMagic\File\Repository\Model\TaskFileCleanupRecordModel;
use Hyperf\DbConnection\Db;

class TaskFileCleanupRecordRepository implements TaskFileCleanupRecordRepositoryInterface
{
    public function __construct(private readonly TaskFileCleanupRecordModel $model)
    {
    }

    /** @param TaskFileCleanupRecordEntity[] $entities */
    public function batchInsert(array $entities): void
    {
        if ($entities !== []) {
            $rows = array_map(
                static fn (TaskFileCleanupRecordEntity $entity): array => self::toRow($entity),
                $entities
            );
            $this->model::query()->insertOrIgnore($rows);
        }
    }

    public function claimPending(int $limit, int $leaseSeconds = 600): array
    {
        $now = date('Y-m-d H:i:s');
        $expiredAt = date('Y-m-d H:i:s', time() - $leaseSeconds);
        $models = $this->model::query()
            ->where('record_type', 'root')
            ->where(function ($query) use ($expiredAt): void {
                $query->where('status', 'pending')
                    ->orWhere(function ($query) use ($expiredAt): void {
                        $query->where('status', 'processing')->where('claimed_at', '<=', $expiredAt);
                    });
            })
            ->orderBy('id')
            ->limit($limit)
            ->get();

        $claimed = [];
        foreach ($models as $model) {
            $updated = $this->model::query()
                ->where('id', $model->id)
                ->where('record_type', 'root')
                ->where(function ($query) use ($expiredAt): void {
                    $query->where('status', 'pending')
                        ->orWhere(function ($query) use ($expiredAt): void {
                            $query->where('status', 'processing')->where('claimed_at', '<=', $expiredAt);
                        });
                })
                ->update([
                    'status' => 'processing',
                    'claimed_at' => $now,
                    'attempt_count' => Db::raw('attempt_count + 1'),
                ]);
            if ($updated > 0) {
                $model->status = 'processing';
                $model->claimed_at = $now;
                $claimed[] = $this->modelToEntity($model);
            }
        }

        return $claimed;
    }

    public function markSuccess(int $id): void
    {
        $this->model::query()->where('id', $id)->update([
            'status' => 'success',
            'processed_at' => date('Y-m-d H:i:s'),
            'error_message' => null,
        ]);
    }

    public function markFailed(int $id, string $errorMessage): void
    {
        $this->model::query()->where('id', $id)->update([
            'status' => 'failed',
            'processed_at' => date('Y-m-d H:i:s'),
            'error_message' => mb_substr($errorMessage, 0, 65535),
        ]);
    }

    public function incrementAttempt(int $id): void
    {
        $this->model::query()->where('id', $id)->update([
            'attempt_count' => Db::raw('attempt_count + 1'),
        ]);
    }

    public function findByOperationAndFile(string $operationId, int $fileId): ?TaskFileCleanupRecordEntity
    {
        $model = $this->model::query()
            ->where('deletion_operation_id', $operationId)
            ->where('original_file_id', $fileId)
            ->first();
        return $model ? $this->modelToEntity($model) : null;
    }

    private function modelToEntity(TaskFileCleanupRecordModel $model): TaskFileCleanupRecordEntity
    {
        return new TaskFileCleanupRecordEntity($model->toArray());
    }

    /** @return array<string, mixed> */
    private static function toRow(TaskFileCleanupRecordEntity $entity): array
    {
        $data = $entity->toArray();
        unset($data['id']);
        return $data;
    }
}
