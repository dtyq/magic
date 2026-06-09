<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

/**
 * Checkpoint rollback files changed event.
 */
class CheckpointRollbackFilesChangedEvent extends AbstractEvent
{
    /**
     * @param array<int, array{file_id: int|string, file_path: string, operation: string}> $fileChanges
     */
    public function __construct(
        private readonly array $fileChanges,
        private readonly string $userId,
        private readonly string $organizationCode,
        private readonly int $projectId,
        private readonly int $topicId = 0,
    ) {
        parent::__construct();
    }

    /**
     * @return array<int, array{file_id: int|string, file_path: string, operation: string}>
     */
    public function getFileChanges(): array
    {
        return $this->fileChanges;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function getTopicId(): int
    {
        return $this->topicId;
    }
}
