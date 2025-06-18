<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WorkspaceVersionEntity;

interface WorkspaceVersionRepositoryInterface
{
    public function create(WorkspaceVersionEntity $entity): WorkspaceVersionEntity;

    public function findById(int $id): ?WorkspaceVersionEntity;

    public function findByTopicId(int $topicId): array;

    public function findByCommitHashAndTopicId(string $commitHash, int $topicId, string $folder = ''): ?WorkspaceVersionEntity;
}
