<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Archive\Repository\Facade;

use App\Domain\Archive\Entity\ValueObject\ArchiveMode;
use App\Domain\Archive\Entity\ValueObject\ArchiveStatus;

interface ArchiveTaskRecordRepositoryInterface
{
    public function updateRunning(string $archiveType, string $statDate, ArchiveMode $archiveMode): void;

    /** @param array<string, mixed> $extra */
    public function updateFinished(
        string $archiveType,
        string $statDate,
        ArchiveStatus $status,
        int $archivedCount,
        string $sourceStartId,
        string $sourceEndId,
        array $extra
    ): void;
}
