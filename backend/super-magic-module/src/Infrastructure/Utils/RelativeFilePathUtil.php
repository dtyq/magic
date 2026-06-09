<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;

/**
 * Utility for building relative file paths from parent_id chains.
 */
class RelativeFilePathUtil
{
    /**
     * @param TaskFileEntity[] $entities
     * @return array<int, TaskFileEntity> [file_id => entity]
     */
    public static function indexByFileId(array $entities): array
    {
        $fileMap = [];
        foreach ($entities as $entity) {
            $fileMap[$entity->getFileId()] = $entity;
        }

        return $fileMap;
    }

    /**
     * @param TaskFileEntity[] $entities
     * @param array<int, TaskFileEntity> $fileMap
     * @return array<int, string> [file_id => relative_path]
     */
    public static function buildPathMapByParentChain(array $entities, array $fileMap): array
    {
        $pathMap = [];
        foreach ($entities as $entity) {
            $pathMap[$entity->getFileId()] = self::buildPathByParentChain($entity, $fileMap);
        }

        return $pathMap;
    }

    /**
     * @param TaskFileEntity[] $entities
     * @return TaskFileEntity[]
     */
    public static function filterByValidParentChain(array $entities): array
    {
        if (empty($entities)) {
            return [];
        }

        $fileMap = self::indexByFileId($entities);
        $filtered = [];

        foreach ($entities as $entity) {
            if (self::hasValidParentChain($entity, $fileMap)) {
                $filtered[] = $entity;
            }
        }

        return $filtered;
    }

    /**
     * @param array<int, TaskFileEntity> $fileMap
     */
    public static function buildPathByParentChain(TaskFileEntity $entity, array $fileMap): string
    {
        $segments = [];
        $visited = [];
        $current = $entity;

        while ($current !== null) {
            $currentId = $current->getFileId();
            if (isset($visited[$currentId])) {
                break;
            }
            $visited[$currentId] = true;

            $name = $current->getFileName();
            if ($name !== '' && $name !== '/') {
                $segments[] = $name;
            }

            $parentId = $current->getParentId();
            if ($parentId === null || $parentId <= 0) {
                break;
            }

            $current = $fileMap[$parentId] ?? null;
        }

        if (empty($segments)) {
            return '/';
        }

        return '/' . implode('/', array_reverse($segments));
    }

    /**
     * @param array<int, TaskFileEntity> $fileMap
     */
    private static function hasValidParentChain(TaskFileEntity $entity, array $fileMap): bool
    {
        $visited = [];
        $current = $entity;

        while (true) {
            $currentId = $current->getFileId();
            if (isset($visited[$currentId])) {
                return false;
            }
            $visited[$currentId] = true;

            $parentId = $current->getParentId();
            if ($parentId === null || $parentId <= 0) {
                return true;
            }

            if (! isset($fileMap[$parentId])) {
                return false;
            }

            $current = $fileMap[$parentId];
        }
    }
}
