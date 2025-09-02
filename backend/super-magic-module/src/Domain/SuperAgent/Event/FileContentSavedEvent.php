<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;

/**
 * 文件内容已保存事件.
 */
class FileContentSavedEvent extends AbstractEvent
{
    public function __construct(
        private readonly TaskFileEntity $fileEntity,
        private readonly string $userId,
        private readonly string $organizationCode,
    ) {
        parent::__construct();
    }

    public function getFileEntity(): TaskFileEntity
    {
        return $this->fileEntity;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }
}
