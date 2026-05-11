<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

/**
 * File tree builder with optional root anchoring.
 */
class FileTreeBuilder
{
    /**
     * Build a tree from a flat list.
     *
     * If rootId is provided and exists in the tree, only its children are returned.
     * If rootId is provided but not present in the list, the tree is returned as-is.
     *
     * @param array $files Flat file list (requires file_id/parent_id/is_directory and name/file_name)
     * @param null|int $rootId Root node id for anchoring (optional)
     * @param null|string $locale Sorting locale (optional)
     */
    public function buildTree(array $files, ?int $rootId = null, ?string $locale = null): array
    {
        $tree = FileTreeUtil::assembleFilesTreeByParentId($files, $locale);

        if ($rootId === null) {
            return $tree;
        }

        $rootNode = $this->findNodeById($tree, (string) $rootId);
        if ($rootNode === null) {
            return $tree;
        }

        return $rootNode['children'] ?? [];
    }

    /**
     * Find a node by file_id or id in a tree.
     */
    private function findNodeById(array $nodes, string $targetId): ?array
    {
        foreach ($nodes as $node) {
            $nodeId = (string) ($node['file_id'] ?? $node['id'] ?? '');
            if ($nodeId === $targetId) {
                return $node;
            }

            if (! empty($node['children'])) {
                $found = $this->findNodeById($node['children'], $targetId);
                if ($found !== null) {
                    return $found;
                }
            }
        }

        return null;
    }
}
