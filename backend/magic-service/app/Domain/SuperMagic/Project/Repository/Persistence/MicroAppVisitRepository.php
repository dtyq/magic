<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Repository\Persistence;

use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppVisitRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Persistence\Model\MicroAppVisitModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Carbon\Carbon;

class MicroAppVisitRepository implements MicroAppVisitRepositoryInterface
{
    private const int RETENTION_LIMIT = 20;

    private const int OVERFLOW_BATCH = 1000;

    private const int THROTTLE_SECONDS = 30;

    public function recordVisit(int $microAppId, string $userId, string $organizationCode): void
    {
        $now = Carbon::now();
        $query = MicroAppVisitModel::query()
            ->where('micro_app_id', $microAppId)
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode);
        $existing = $query->first();
        if (
            $existing !== null && $existing->last_visited_at !== null
            && Carbon::parse($existing->last_visited_at)->gt($now->copy()->subSeconds(self::THROTTLE_SECONDS))
        ) {
            return;
        }

        if ($existing instanceof MicroAppVisitModel) {
            $visitId = $existing->id ?? IdGenerator::getSnowId();
            $createdAt = $existing->created_at ?? $now;
        } else {
            $visitId = IdGenerator::getSnowId();
            $createdAt = $now;
        }

        MicroAppVisitModel::query()->upsert([
            [
                'id' => $visitId,
                'micro_app_id' => $microAppId,
                'user_id' => $userId,
                'organization_code' => $organizationCode,
                'last_visited_at' => $now,
                'created_at' => $createdAt,
                'updated_at' => $now,
            ],
        ], ['micro_app_id', 'user_id', 'organization_code'], ['last_visited_at', 'updated_at']);

        $oldIds = $this->applyOverflowVisitWindow(
            MicroAppVisitModel::query()
                ->where('user_id', $userId)
                ->where('organization_code', $organizationCode)
        )->pluck('id');
        if ($oldIds->isNotEmpty()) {
            MicroAppVisitModel::query()
                ->where('user_id', $userId)
                ->where('organization_code', $organizationCode)
                ->whereIn('id', $oldIds->all())
                ->delete();
        }
    }

    /**
     * MySQL requires LIMIT together with OFFSET.
     */
    protected function applyOverflowVisitWindow(object $query): object
    {
        return $query
            ->orderByDesc('last_visited_at')
            ->orderByDesc('micro_app_id')
            ->offset(self::RETENTION_LIMIT)
            ->limit(self::OVERFLOW_BATCH);
    }
}
