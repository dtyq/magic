<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Archive\Repository\Persistence;

use App\Domain\Archive\Entity\ValueObject\ArchiveMode;
use App\Domain\Archive\Entity\ValueObject\ArchiveStatus;
use App\Domain\Archive\Repository\Facade\ArchiveTaskRecordRepositoryInterface;
use App\Domain\Archive\Repository\Persistence\Model\ArchiveTaskRecordModel;

final class ArchiveTaskRecordRepository implements ArchiveTaskRecordRepositoryInterface
{
    public function updateRunning(string $archiveType, string $statDate, ArchiveMode $archiveMode): void
    {
        $attributes = [
            'archive_mode' => $archiveMode->value,
            'status' => ArchiveStatus::Running->value,
            'started_at' => date('Y-m-d H:i:s'),
            'finished_at' => null,
        ];
        if ($archiveMode === ArchiveMode::Full) {
            $attributes += [
                'archived_count' => 0,
                'source_start_id' => '',
                'source_end_id' => '',
                'extra' => null,
            ];
        }

        ArchiveTaskRecordModel::query()->updateOrCreate(
            ['archive_type' => $archiveType, 'stat_date' => $statDate],
            $attributes
        );
    }

    public function updateFinished(
        string $archiveType,
        string $statDate,
        ArchiveStatus $status,
        int $archivedCount,
        string $sourceStartId,
        string $sourceEndId,
        array $extra
    ): void {
        ArchiveTaskRecordModel::query()->updateOrCreate(
            ['archive_type' => $archiveType, 'stat_date' => $statDate],
            [
                'status' => $status->value,
                'archived_count' => $archivedCount,
                'source_start_id' => $sourceStartId,
                'source_end_id' => $sourceEndId,
                'extra' => $extra,
                'finished_at' => date('Y-m-d H:i:s'),
            ]
        );
    }
}
