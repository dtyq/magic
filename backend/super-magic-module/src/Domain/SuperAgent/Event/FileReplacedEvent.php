<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileVersionEntity;

/**
 * File replaced event.
 */
class FileReplacedEvent
{
    public function __construct(
        private readonly TaskFileEntity $fileEntity,
        private readonly ?TaskFileVersionEntity $versionEntity,
        private readonly MagicUserAuthorization $userAuthorization,
        private readonly bool $isCrossTypeReplace
    ) {
    }

    /**
     * Get file entity.
     */
    public function getFileEntity(): TaskFileEntity
    {
        return $this->fileEntity;
    }

    /**
     * Get version entity.
     */
    public function getVersionEntity(): ?TaskFileVersionEntity
    {
        return $this->versionEntity;
    }

    /**
     * Get user authorization.
     */
    public function getUserAuthorization(): MagicUserAuthorization
    {
        return $this->userAuthorization;
    }

    /**
     * Check if this is a cross-type replace.
     */
    public function isCrossTypeReplace(): bool
    {
        return $this->isCrossTypeReplace;
    }

    /**
     * Get file ID.
     */
    public function getFileId(): int
    {
        return $this->fileEntity->getFileId();
    }

    /**
     * Get project ID.
     */
    public function getProjectId(): int
    {
        return $this->fileEntity->getProjectId();
    }

    /**
     * Get file name.
     */
    public function getFileName(): string
    {
        return $this->fileEntity->getFileName();
    }
}
