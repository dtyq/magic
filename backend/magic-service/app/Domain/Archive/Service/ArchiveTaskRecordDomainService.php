<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Archive\Service;

use App\Domain\Archive\Entity\ValueObject\ArchiveMode;
use App\Domain\Archive\Entity\ValueObject\ArchiveStatus;
use App\Domain\Archive\Repository\Facade\ArchiveTaskRecordRepositoryInterface;

final readonly class ArchiveTaskRecordDomainService
{
    public function __construct(
        private ArchiveTaskRecordRepositoryInterface $repository,
    ) {
    }

    public function start(string $archiveType, string $statDate, ArchiveMode $mode): void
    {
        $this->repository->updateRunning($archiveType, $statDate, $mode);
    }

    /** @param array<string, mixed> $extra */
    public function complete(
        string $archiveType,
        string $statDate,
        int $archivedCount,
        string $sourceStartId = '',
        string $sourceEndId = '',
        array $extra = [],
    ): void {
        $this->repository->updateFinished(
            $archiveType,
            $statDate,
            ArchiveStatus::Success,
            $archivedCount,
            $sourceStartId,
            $sourceEndId,
            $extra
        );
    }

    public function fail(string $archiveType, string $statDate, string $errorMessage): void
    {
        $this->repository->updateFinished(
            $archiveType,
            $statDate,
            ArchiveStatus::Failed,
            0,
            '',
            '',
            ['error_message' => $errorMessage]
        );
    }
}
