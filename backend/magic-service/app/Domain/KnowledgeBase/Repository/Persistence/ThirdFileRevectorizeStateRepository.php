<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Repository\Persistence;

use App\Domain\KnowledgeBase\Repository\Facade\ThirdFileRevectorizeStateRepositoryInterface;
use App\Domain\KnowledgeBase\Repository\Persistence\Model\ThirdFileRevectorizeStateModel;
use Carbon\Carbon;
use DateTimeInterface;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;

class ThirdFileRevectorizeStateRepository implements ThirdFileRevectorizeStateRepositoryInterface
{
    public function recordNotification(
        string $organizationCode,
        string $thirdPlatformType,
        string $thirdFileId,
        array $payload,
        DateTimeInterface $now,
        int $cooldownMinutes,
    ): bool {
        $now = Carbon::parse($now->format('Y-m-d H:i:s'));
        ThirdFileRevectorizeStateModel::query()->insertOrIgnore([
            'organization_code' => $organizationCode,
            'third_platform_type' => $thirdPlatformType,
            'third_file_id' => $thirdFileId,
            'latest_payload' => Json::encode($payload),
            'last_execute_at' => null,
            'next_execute_at' => null,
            'status' => 'idle',
            'notification_count' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return Db::transaction(function () use (
            $organizationCode,
            $thirdPlatformType,
            $thirdFileId,
            $payload,
            $now,
            $cooldownMinutes,
        ): bool {
            /** @var null|ThirdFileRevectorizeStateModel $state */
            $state = ThirdFileRevectorizeStateModel::query()
                ->where('organization_code', $organizationCode)
                ->where('third_platform_type', $thirdPlatformType)
                ->where('third_file_id', $thirdFileId)
                ->lockForUpdate()
                ->first();
            if ($state === null) {
                return false;
            }

            $lastExecuteAt = $state->last_execute_at !== null
                ? Carbon::parse($state->last_execute_at)
                : null;
            $cooldownUntil = $lastExecuteAt?->copy()->addMinutes($cooldownMinutes);
            $shouldExecute = $cooldownUntil === null || $cooldownUntil->lessThanOrEqualTo($now);

            $state->fill([
                'latest_payload' => $payload,
                'last_execute_at' => $shouldExecute ? $now : $lastExecuteAt,
                'next_execute_at' => $shouldExecute ? null : $cooldownUntil,
                'status' => $shouldExecute ? 'idle' : 'pending',
                'notification_count' => $state->notification_count + 1,
            ]);
            $state->save();

            return $shouldExecute;
        });
    }

    public function claimDuePayloads(DateTimeInterface $now, int $limit): array
    {
        $now = Carbon::parse($now->format('Y-m-d H:i:s'));
        $ids = ThirdFileRevectorizeStateModel::query()
            ->where('status', 'pending')
            ->whereNotNull('next_execute_at')
            ->where('next_execute_at', '<=', $now)
            ->orderBy('next_execute_at')
            ->limit(max(1, $limit))
            ->pluck('id')
            ->all();

        $payloads = [];
        foreach ($ids as $id) {
            $payload = Db::transaction(function () use ($id, $now): ?array {
                /** @var null|ThirdFileRevectorizeStateModel $state */
                $state = ThirdFileRevectorizeStateModel::query()
                    ->where('id', $id)
                    ->lockForUpdate()
                    ->first();
                if ($state === null || $state->status !== 'pending' || $state->next_execute_at === null) {
                    return null;
                }
                if (Carbon::parse($state->next_execute_at)->isAfter($now)) {
                    return null;
                }

                $payload = $state->latest_payload;
                $state->fill([
                    'last_execute_at' => $now,
                    'next_execute_at' => null,
                    'status' => 'idle',
                ]);
                $state->save();

                return is_array($payload) ? $payload : null;
            });
            if ($payload !== null) {
                $payloads[] = $payload;
            }
        }
        return $payloads;
    }
}
