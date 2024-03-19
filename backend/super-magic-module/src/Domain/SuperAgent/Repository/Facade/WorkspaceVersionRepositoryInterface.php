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

    public function findByCommitHashAndProjectId(string $commitHash, int $projectId, string $folder = ''): ?WorkspaceVersionEntity;

    public function findByProjectId(int $projectId, string $folder = ''): ?WorkspaceVersionEntity;

    public function getLatestVersionByProjectId(int $projectId): ?WorkspaceVersionEntity;

    public function getLatestUpdateVersionProjectId(int $projectId): ?WorkspaceVersionEntity;

    public function getTagByCommitHashAndProjectId(string $commitHash, int $projectId): int;
}
