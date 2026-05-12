<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\MagicFS\DTO;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;

class UpsertProjectFileNodeDTO
{
    public function __construct(
        private readonly int $projectId,
        private readonly string $projectWorkDir,
        private readonly string $projectOrganizationCode,
        private readonly string $operatorUserId,
        private readonly string $operatorOrganizationCode,
        private readonly TaskFileEntity $taskFileEntity,
        private readonly string $storageTypeOverride = '',
        private readonly bool $isUpdated = true,
        private readonly bool $withTrash = true,
    ) {
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function getProjectWorkDir(): string
    {
        return $this->projectWorkDir;
    }

    public function getProjectOrganizationCode(): string
    {
        return $this->projectOrganizationCode;
    }

    public function getOperatorUserId(): string
    {
        return $this->operatorUserId;
    }

    public function getOperatorOrganizationCode(): string
    {
        return $this->operatorOrganizationCode;
    }

    public function getTaskFileEntity(): TaskFileEntity
    {
        return $this->taskFileEntity;
    }

    public function getStorageTypeOverride(): string
    {
        return $this->storageTypeOverride;
    }

    public function isUpdated(): bool
    {
        return $this->isUpdated;
    }

    public function isWithTrash(): bool
    {
        return $this->withTrash;
    }
}
