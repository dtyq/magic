<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Factory;

/**
 * Path Factory - Handle path generation for design module.
 */
class PathFactory
{
    /**
     * Get workspace prefix path.
     *
     * @param string $filePrefix Organization prefix, e.g. /org
     * @param int $projectId Project ID
     * @return string Workspace prefix, e.g. /org/project_123/workspace
     */
    public static function getWorkspacePrefix(string $filePrefix, int $projectId): string
    {
        $filePrefix = rtrim($filePrefix, '/');
        return "{$filePrefix}/project_{$projectId}/workspace";
    }

    /**
     * Build full directory path from relative path.
     *
     * @param string $filePrefix Organization prefix, e.g. /org
     * @param int $projectId Project ID
     * @param string $relativeDir Relative directory path, e.g. /some/dir or /
     * @return string Full directory path, e.g. /org/project_123/workspace/some/dir
     */
    public static function buildFullDirPath(string $filePrefix, int $projectId, string $relativeDir): string
    {
        $workspacePrefix = self::getWorkspacePrefix($filePrefix, $projectId);

        if ($relativeDir === '/') {
            return $workspacePrefix;
        }
        $relativeDir = rtrim($relativeDir, '/') . '/';

        return $workspacePrefix . $relativeDir;
    }

    /**
     * Build full file path from relative directory and filename.
     *
     * @param string $filePrefix Organization prefix, e.g. /org
     * @param int $projectId Project ID
     * @param string $relativeDir Relative directory path, e.g. /some/dir or /
     * @param string $fileName File name, e.g. image.png
     * @return string Full file path, e.g. /org/project_123/workspace/some/dir/image.png
     */
    public static function buildFullFilePath(string $filePrefix, int $projectId, string $relativeDir, string $fileName): string
    {
        $fullDir = self::buildFullDirPath($filePrefix, $projectId, $relativeDir);
        return rtrim($fullDir, '/') . '/' . $fileName;
    }
}
