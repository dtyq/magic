<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

/**
 * File tree builder utility class.
 *
 * Supports VS Code-style sorting:
 * 1. Directories before files
 * 2. Natural number sorting (file2 < file10)
 * 3. Case-insensitive comparison
 * 4. Multi-language support (Chinese pinyin sorting with zh_CN locale)
 */
class FileTreeUtil
{
    /**
     * Assemble file list into tree structure with unlimited nesting.
     *
     * Uses relative_file_path to build tree structure, supports is_directory field.
     *
     * @param array $files File list data
     * @param null|string $locale Locale for sorting (e.g., 'zh_CN', 'en_US')
     * @return array Tree structure array
     */
    public static function assembleFilesTree(array $files, ?string $locale = null): array
    {
        if (empty($files)) {
            return [];
        }

        // 预处理：按排序值对文件进行排序
        usort($files, function ($a, $b) {
            // 首先按父目录分组
            $aParentId = $a['parent_id'] ?? 0;
            $bParentId = $b['parent_id'] ?? 0;

            if ($aParentId !== $bParentId) {
                return $aParentId <=> $bParentId;
            }

            // 同一父目录下按排序值排序
            $aSortValue = $a['sort'] ?? 0;
            $bSortValue = $b['sort'] ?? 0;

            if ($aSortValue === $bSortValue) {
                // 排序值相同时按file_id排序
                $aFileId = $a['file_id'] ?? 0;
                $bFileId = $b['file_id'] ?? 0;
                return $aFileId <=> $bFileId;
            }

            return $aSortValue <=> $bSortValue;
        });

        // 预处理：为每个文件确定类型和标准化路径
        $processedFiles = [];
        foreach ($files as $file) {
            $relativePath = $file['relative_file_path'] ?? '';
            if (empty($relativePath)) {
                continue; // 跳过没有相对路径的文件
            }

            // 标准化路径：移除开头的斜杠，确保以斜杠结尾的是目录
            $normalizedPath = ltrim($relativePath, '/');

            // 检测是否为目录
            $isDirectory = self::detectIsDirectory($file);

            $processedFiles[] = [
                'original_data' => $file,
                'normalized_path' => $normalizedPath,
                'is_directory' => $isDirectory,
                'path_parts' => $normalizedPath ? explode('/', rtrim($normalizedPath, '/')) : [],
            ];
        }

        // 构建文件树
        $root = [
            'type' => 'root',
            'is_directory' => true,
            'is_hidden' => false,
            'children' => [],
        ];

        // 目录映射，用于快速查找目录节点
        $directoryMap = ['' => &$root];

        // 第一步：创建所有目录节点
        foreach ($processedFiles as $processedFile) {
            if (! $processedFile['is_directory']) {
                continue;
            }

            $pathParts = $processedFile['path_parts'];
            if (empty($pathParts)) {
                continue;
            }

            self::ensureDirectoryPath($directoryMap, $pathParts, $processedFile['original_data']);
        }

        // 第二步：放置所有文件到对应目录
        foreach ($processedFiles as $processedFile) {
            if ($processedFile['is_directory']) {
                continue;
            }

            $pathParts = $processedFile['path_parts'];
            if (empty($pathParts)) {
                continue;
            }

            // 文件名是路径的最后一部分
            $fileName = array_pop($pathParts);

            // 确保父目录存在
            if (! empty($pathParts)) {
                self::ensureDirectoryPath($directoryMap, $pathParts);
            }

            // 创建文件节点
            $fileNode = $processedFile['original_data'];
            $fileNode['type'] = 'file';
            $fileNode['is_directory'] = false;
            $fileNode['children'] = [];
            $fileNode['name'] = $fileName;

            // 检测是否为隐藏文件
            if (! isset($fileNode['is_hidden'])) {
                $fileNode['is_hidden'] = str_starts_with($fileName, '.');
            }

            // 获取父目录路径
            $parentPath = empty($pathParts) ? '' : implode('/', $pathParts);

            // 将文件添加到父目录
            if (isset($directoryMap[$parentPath])) {
                $directoryMap[$parentPath]['children'][] = $fileNode;
            }
        }

        // Step 3: Sort all directory children using VS Code-style sorting
        $sorter = new FileNameSorter($locale);
        self::sortAllDirectoryChildren($root, $sorter);

        return $root['children'];
    }

    /**
     * 获取文件树的统计信息.
     *
     * @param array $tree 文件树
     * @return array 统计信息 ['directories' => int, 'files' => int, 'total_size' => int]
     */
    public static function getTreeStats(array $tree): array
    {
        $stats = [
            'directories' => 0,
            'files' => 0,
            'total_size' => 0,
        ];

        self::walkTree($tree, function ($node) use (&$stats) {
            if ($node['is_directory']) {
                ++$stats['directories'];
            } else {
                ++$stats['files'];
                $stats['total_size'] += $node['file_size'] ?? 0;
            }
        });

        return $stats;
    }

    /**
     * 扁平化文件树，返回所有文件的路径列表.
     *
     * @param array $tree 文件树
     * @param string $basePath 基础路径
     * @return array 文件路径列表
     */
    public static function flattenTree(array $tree, string $basePath = ''): array
    {
        $paths = [];

        foreach ($tree as $node) {
            $currentPath = empty($basePath) ? ($node['name'] ?? '') : $basePath . '/' . ($node['name'] ?? '');

            if (! $node['is_directory']) {
                $paths[] = $currentPath;
            } else {
                if (! empty($node['children'])) {
                    $childPaths = self::flattenTree($node['children'], $currentPath);
                    $paths = array_merge($paths, $childPaths);
                }
            }
        }

        return $paths;
    }

    /**
     * 根据路径查找文件树中的节点.
     *
     * @param array $tree 文件树
     * @param string $path 要查找的路径
     * @return null|array 找到的节点，如果未找到返回null
     */
    public static function findNodeByPath(array $tree, string $path): ?array
    {
        $pathParts = explode('/', trim($path, '/'));
        $current = ['children' => $tree];

        foreach ($pathParts as $part) {
            if (empty($part)) {
                continue;
            }

            $found = false;
            foreach ($current['children'] as $child) {
                if (($child['name'] ?? '') === $part) {
                    $current = $child;
                    $found = true;
                    break;
                }
            }

            if (! $found) {
                return null;
            }
        }

        return $current;
    }

    /**
     * Build file tree based on parent_id, supporting multi-root scenarios.
     *
     * When selected files are siblings (same parent_id), but parent directory is not selected,
     * this method can automatically identify these files as root nodes.
     *
     * @param array $files File list, must contain file_id and parent_id fields
     * @param null|string $locale Locale for sorting (e.g., 'zh_CN', 'en_US')
     * @return array Tree structure same format as assembleFilesTree
     */
    public static function assembleFilesTreeByParentId(array $files, ?string $locale = null): array
    {
        if (empty($files)) {
            return [];
        }

        // 1. 收集所有存在的 file_id 和构建文件映射
        $existingFileIds = [];
        $fileMap = [];

        foreach ($files as $file) {
            $fileId = $file['file_id'] ?? 0;
            if ($fileId > 0) {
                $existingFileIds[] = $fileId;
                $fileMap[$fileId] = $file;
            }
        }

        // 2. 按 parent_id 分组，识别根节点和子节点
        $parentChildMap = [];  // parent_id => [child_files]
        $rootNodes = [];       // 根节点（parent_id 不在现有文件中）

        foreach ($files as $file) {
            $fileId = $file['file_id'] ?? 0;
            $parentId = $file['parent_id'] ?? 0;

            if ($parentId <= 0 || ! in_array($parentId, $existingFileIds)) {
                // 父节点不存在于当前文件列表中，视为根节点
                $rootNodes[] = $file;
            } else {
                // 父节点存在，加入父子映射
                if (! isset($parentChildMap[$parentId])) {
                    $parentChildMap[$parentId] = [];
                }
                $parentChildMap[$parentId][] = $file;
            }
        }

        // 3. Create sorter instance for VS Code-style sorting
        $sorter = new FileNameSorter($locale);

        // 4. Recursively build tree structure
        $result = [];

        // Process root nodes
        foreach ($rootNodes as $rootFile) {
            $result[] = self::buildNodeWithChildren($rootFile, $parentChildMap, $sorter);
        }

        // 5. Sort root nodes
        $sorter->sort($result);

        return $result;
    }

    /**
     * 判断目录名是否为隐藏目录
     * 隐藏目录的判断规则：目录名以 . 开头.
     *
     * @param string $dirName 目录名
     * @return bool true-隐藏目录，false-普通目录
     */
    private static function isHiddenDirectory(string $dirName): bool
    {
        return str_starts_with($dirName, '.');
    }

    /**
     * 遍历文件树，对每个节点执行回调函数.
     *
     * @param array $tree 文件树
     * @param callable $callback 回调函数
     */
    private static function walkTree(array $tree, callable $callback): void
    {
        foreach ($tree as $node) {
            $callback($node);
            if (! empty($node['children'])) {
                self::walkTree($node['children'], $callback);
            }
        }
    }

    /**
     * 检测文件项是否为目录
     * 优先使用 is_directory 字段，回退到路径分析.
     *
     * @param array $file 文件数据
     * @return bool true-目录，false-文件
     */
    private static function detectIsDirectory(array $file): bool
    {
        // 优先使用 is_directory 字段（新数据）
        if (isset($file['is_directory'])) {
            return (bool) $file['is_directory'];
        }

        // 回退到路径分析（历史数据兼容）
        $relativePath = $file['relative_file_path'] ?? '';

        // 路径以斜杠结尾通常表示目录
        if (str_ends_with($relativePath, '/')) {
            return true;
        }

        // 没有文件扩展名且 file_size 为 0 可能是目录
        $fileExtension = $file['file_extension'] ?? '';
        $fileSize = $file['file_size'] ?? 0;

        if (empty($fileExtension) && $fileSize === 0) {
            return true;
        }

        return false;
    }

    /**
     * 确保目录路径存在，如果不存在则创建.
     *
     * @param array &$directoryMap 目录映射表的引用
     * @param array $pathParts 路径部分数组
     * @param null|array $directoryData 目录的原始数据（可选）
     */
    private static function ensureDirectoryPath(array &$directoryMap, array $pathParts, ?array $directoryData = null): void
    {
        $currentPath = '';
        $parentIsHidden = false;

        foreach ($pathParts as $index => $dirName) {
            if (empty($dirName)) {
                continue;
            }

            // 构建当前路径
            $currentPath = empty($currentPath) ? $dirName : "{$currentPath}/{$dirName}";

            // 如果目录不存在，创建它
            if (! isset($directoryMap[$currentPath])) {
                // 判断是否为隐藏目录
                $isHiddenDir = self::isHiddenDirectory($dirName) || $parentIsHidden;

                // 创建目录节点
                $newDir = [
                    'name' => $dirName,
                    'path' => $currentPath,
                    'type' => 'directory',
                    'is_directory' => true,
                    'is_hidden' => $isHiddenDir,
                    'children' => [],
                ];

                // 如果是最后一个路径部分且提供了目录数据，合并原始数据
                if ($index === count($pathParts) - 1 && $directoryData) {
                    $newDir = array_merge($directoryData, $newDir);
                }

                // 获取父目录路径
                $parentPath = '';
                if ($index > 0) {
                    $parentParts = array_slice($pathParts, 0, $index);
                    $parentPath = implode('/', $parentParts);
                }

                // 将新目录添加到父目录
                if (isset($directoryMap[$parentPath])) {
                    $directoryMap[$parentPath]['children'][] = $newDir;
                    // 获取刚添加的目录的引用
                    $directoryMap[$currentPath] = &$directoryMap[$parentPath]['children'][count($directoryMap[$parentPath]['children']) - 1];
                }
            }

            // 更新父级隐藏状态
            $parentIsHidden = $directoryMap[$currentPath]['is_hidden'] ?? false;
        }
    }

    /**
     * Recursively sort all directory children using VS Code-style sorting.
     *
     * @param array &$directory Directory node with children
     * @param FileNameSorter $sorter Sorter instance for consistent locale handling
     */
    private static function sortAllDirectoryChildren(array &$directory, FileNameSorter $sorter): void
    {
        if (empty($directory['children'])) {
            return;
        }

        // Sort current directory's children using FileNameSorter
        $sorter->sort($directory['children']);

        // Recursively sort subdirectories
        foreach ($directory['children'] as &$child) {
            if ($child['is_directory'] ?? false) {
                self::sortAllDirectoryChildren($child, $sorter);
            }
        }
    }

    /**
     * Recursively build node and its children.
     *
     * @param array $file File data
     * @param array $parentChildMap Parent-child relationship mapping [parent_id => [children]]
     * @param FileNameSorter $sorter Sorter instance for consistent locale handling
     * @return array Normalized node data
     */
    private static function buildNodeWithChildren(array $file, array $parentChildMap, FileNameSorter $sorter): array
    {
        // Normalize node format, consistent with assembleFilesTree
        $node = $file;
        $node['type'] = ($file['is_directory'] ?? false) ? 'directory' : 'file';
        $node['children'] = [];

        // Ensure required fields exist
        if (! isset($node['name'])) {
            $node['name'] = $node['file_name'] ?? '';
        }

        // If there are child nodes, build recursively
        $fileId = $file['file_id'] ?? 0;
        if (isset($parentChildMap[$fileId]) && ! empty($parentChildMap[$fileId])) {
            foreach ($parentChildMap[$fileId] as $childFile) {
                $node['children'][] = self::buildNodeWithChildren($childFile, $parentChildMap, $sorter);
            }

            // Sort child nodes using FileNameSorter
            $sorter->sort($node['children']);
        }

        return $node;
    }
}
