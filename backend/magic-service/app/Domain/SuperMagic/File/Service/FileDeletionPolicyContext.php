<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Service;

use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Infrastructure\SuperMagic\Utils\WorkFileUtil;

final class FileDeletionPolicyContext
{
    /** @var array<int, bool> */
    private array $rootHidden = [];

    /**
     * @param array<int, TaskEntity> $tasks
     * @param array<int, TopicEntity> $topics
     * @param array<int, TaskFileEntity> $files
     */
    public function __construct(
        public readonly array $tasks = [],
        public readonly array $topics = [],
        public readonly array $files = [],
    ) {
    }

    public function task(int $id): ?TaskEntity
    {
        return $this->tasks[$id] ?? null;
    }

    public function topic(int $id): ?TopicEntity
    {
        return $this->topics[$id] ?? null;
    }

    public function isUnderRootHiddenDirectory(int $fileId): bool
    {
        $visited = [];
        $hidden = false;
        while (isset($this->files[$fileId]) && ! isset($visited[$fileId])) {
            if (array_key_exists($fileId, $this->rootHidden)) {
                $hidden = $this->rootHidden[$fileId];
                break;
            }
            $visited[$fileId] = true;
            $file = $this->files[$fileId];
            $parentId = $file->getParentId();
            if ($parentId === null || $parentId <= 0) {
                break;
            }

            $parent = $this->files[$parentId] ?? null;
            if ($parent === null) {
                break;
            }

            // Project files are rooted at the synthetic "/" directory. The
            // hidden rule applies to its direct child, not to the root node.
            if ($parent->getParentId() === null
                && $parent->getFileName() === '/'
                && $file->getIsDirectory()) {
                $hidden = WorkFileUtil::isHiddenFileName($file->getFileName());
                break;
            }

            $fileId = $parentId;
        }
        // Missing ancestors and cycles cannot prove membership in a hidden root.
        foreach ($visited as $id => $_) {
            $this->rootHidden[$id] = $hidden;
        }

        return $hidden;
    }
}
