<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Persistence;

use Carbon\Carbon;
use Dtyq\AsyncEvent\Kernel\Constants\Status;
use Dtyq\AsyncEvent\Kernel\Persistence\Model\AsyncEventModel;

class AsyncEventRepository
{
    public function create(array $data): AsyncEventModel
    {
        $model = new AsyncEventModel();
        $model->fill($data);
        $model->save();
        return $model;
    }

    public function exists(int $id): bool
    {
        return AsyncEventModel::query()->where('id', '=', $id)->select('id')->exists();
    }

    public function updateById(int $id, array $data): void
    {
        AsyncEventModel::query()->where('id', '=', $id)->update($data);
    }

    public function retryById(int $id): void
    {
        AsyncEventModel::query()->where('id', '=', $id)->increment('retry_times', 1, ['updated_at' => Carbon::now()]);
    }

    public function getById(int $id): ?AsyncEventModel
    {
        return AsyncEventModel::find($id);
    }

    public function getTimeoutRecordIds(string $datetime, int $limit = 100): array
    {
        return AsyncEventModel::query()
            ->where('updated_at', '<', $datetime)
            ->whereIn('status', [Status::STATE_WAIT, Status::STATE_IN_EXECUTION])
            ->limit($limit)
            ->pluck('id')
            ->toArray();
    }

    public function deleteById(int $id): int
    {
        return AsyncEventModel::query()->where('id', '=', $id)->delete();
    }

    public function deleteHistory(array $where)
    {
        $ids = AsyncEventModel::query()
            ->where($where)
            ->limit(10000)
            ->pluck('id')
            ->toArray();
        if (empty($ids)) {
            return 0;
        }
        return AsyncEventModel::query()
            ->whereIn('id', $ids)
            ->delete();
    }
}
