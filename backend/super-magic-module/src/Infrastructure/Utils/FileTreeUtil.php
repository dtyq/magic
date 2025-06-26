<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

/**
 * 文件树构建工具类.
 */
class FileTreeUtil
{
    /**
     * 将文件列表组装成树状结构，支持无限极嵌套.
     *
     * @param string $workDir 工作目录
     * @param array $files 文件列表数据
     * @return array 树状结构数组
     */
    public static function assembleFilesTree(string $workDir, array $files): array
    {
        if (empty($files)) {
            return [];
        }

        // 文件树根节点
        $root = [
            'type' => 'root',
            'is_directory' => true,
            'is_hidden' => false,
            'children' => [],
        ];

        // 目录映射，用于快速查找目录节点
        $directoryMap = ['' => &$root]; // 根目录的引用

        // 去掉workDir开头可能的斜杠，确保匹配
        $workDir = ltrim($workDir, '/');

        // 遍历所有文件路径，确定根目录
        $rootDir = '';
        foreach ($files as $file) {
            if (empty($file['file_key'])) {
                continue; // 跳过没有文件路径的记录
            }

            $filePath = $file['file_key'];

            // 查找workDir在文件路径中的位置
            $workDirPos = strpos($filePath, $workDir);
            if ($workDirPos === false) {
                continue; // 找不到workDir，跳过
            }

            // 获取workDir结束的位置
            $rootDir = substr($filePath, 0, $workDirPos + strlen($workDir));
            break;
        }

        // 如果没有找到有效的根目录，创建一个扁平的目录结构
        if (empty($rootDir)) {
            // 直接将所有文件作为根节点的子节点
            foreach ($files as $file) {
                if (empty($file['file_key'])) {
                    continue; // 跳过没有文件路径的记录
                }

                // 提取文件名，通常是路径最后一部分
                $pathParts = explode('/', $file['file_key']);
                $fileName = end($pathParts);

                // 创建文件节点
                $fileNode = $file;
                $fileNode['type'] = 'file';
                $fileNode['is_directory'] = false;
                $fileNode['children'] = [];
                $fileNode['name'] = $fileName;

                // 添加到根节点
                $root['children'][] = $fileNode;
            }

            return $root['children'];
        }

        // 处理所有文件
        foreach ($files as $file) {
            if (empty($file['file_key'])) {
                continue; // 跳过没有文件路径的记录
            }

            $filePath = $file['file_key'];

            // 提取相对路径
            if (strpos($filePath, $rootDir) === 0) {
                // 移除根目录前缀，获取相对路径
                $relativePath = substr($filePath, strlen($rootDir));
                $relativePath = ltrim($relativePath, '/');

                // 创建文件节点
                $fileNode = $file;
                $fileNode['type'] = 'file';
                $fileNode['is_directory'] = false;
                $fileNode['children'] = [];

                // 如果相对路径为空，表示文件直接位于根目录
                if (empty($relativePath)) {
                    $root['children'][] = $fileNode;
                    continue;
                }

                // 分析相对路径，提取目录部分和文件名
                $pathParts = explode('/', $relativePath);
                $fileName = array_pop($pathParts); // 移除并获取最后一部分作为文件名

                if (empty($pathParts)) {
                    // 没有目录部分，文件直接位于根目录下
                    $root['children'][] = $fileNode;
                    continue;
                }

                // 逐级构建目录
                $currentPath = '';
                $parent = &$root;
                $parentIsHidden = false; // 父级是否为隐藏目录

                foreach ($pathParts as $dirName) {
                    if (empty($dirName)) {
                        continue; // 跳过空目录名
                    }

                    // 更新当前路径
                    $currentPath = empty($currentPath) ? $dirName : "{$currentPath}/{$dirName}";

                    // 如果当前路径的目录不存在，创建它
                    if (! isset($directoryMap[$currentPath])) {
                        // 判断当前目录是否为隐藏目录
                        $isHiddenDir = self::isHiddenDirectory($dirName) || $parentIsHidden;

                        // 创建新目录节点
                        $newDir = [
                            'name' => $dirName,
                            'path' => $currentPath,
                            'type' => 'directory',
                            'is_directory' => true,
                            'is_hidden' => $isHiddenDir,
                            'children' => [],
                        ];

                        // 将新目录添加到父目录的子项中
                        $parent['children'][] = $newDir;

                        // 保存目录引用到映射中
                        $directoryMap[$currentPath] = &$parent['children'][count($parent['children']) - 1];
                    }

                    // 更新父目录引用为当前目录
                    $parent = &$directoryMap[$currentPath];
                    // 更新父级隐藏状态，如果当前目录是隐藏的，那么其子级都应该是隐藏的
                    $parentIsHidden = $parent['is_hidden'] ?? false;
                }

                // 如果父目录是隐藏的，那么文件也应该被标记为隐藏
                if ($parentIsHidden) {
                    $fileNode['is_hidden'] = true;
                }

                // 将文件添加到最终目录的子项中
                $parent['children'][] = $fileNode;
            }
        }

        // 返回根目录的子项作为结果
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
}
