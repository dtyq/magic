<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileCleanupRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TaskFileModel;
use Hyperf\DbConnection\Db;

class TaskFileCleanupRepository implements TaskFileCleanupRepositoryInterface
{
    public function __construct(protected TaskFileModel $model)
    {
    }

    /**
     * Get all statistics in one query (optimized).
     * Returns: ['deleted' => int, 'directory' => int, 'file' => int].
     */
    public function getAllStatistics(?int $projectId = null, ?string $fileKey = null): array
    {
        $whereConditions = ['file_key IS NOT NULL', "file_key != ''"];
        $params = [];

        if ($projectId !== null) {
            $whereConditions[] = 'project_id = ?';
            $params[] = $projectId;
        }

        if ($fileKey !== null) {
            $whereConditions[] = 'file_key = ?';
            $params[] = $fileKey;
        }

        $whereClause = implode(' AND ', $whereConditions);

        $sql = "
            SELECT 
                SUM(CASE 
                    WHEN duplicate_type = 'deleted' THEN 1 
                    ELSE 0 
                END) as deleted_count,
                SUM(CASE 
                    WHEN duplicate_type = 'directory' THEN 1 
                    ELSE 0 
                END) as directory_count,
                SUM(CASE 
                    WHEN duplicate_type = 'file' THEN 1 
                    ELSE 0 
                END) as file_count
            FROM (
                SELECT 
                    file_key,
                    COUNT(*) as total_count,
                    SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as deleted_count,
                    MAX(is_directory) as is_directory,
                    CASE
                        WHEN COUNT(*) = SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) THEN 'deleted'
                        WHEN MAX(is_directory) = 1 THEN 'directory'
                        ELSE 'file'
                    END as duplicate_type
                FROM magic_super_agent_task_files
                WHERE {$whereClause}
                GROUP BY file_key
                HAVING COUNT(*) > 1
            ) as duplicates
        ";

        $result = Db::selectOne($sql, $params);

        return [
            'deleted' => (int) ($result['deleted_count'] ?? 0),
            'directory' => (int) ($result['directory_count'] ?? 0),
            'file' => (int) ($result['file_count'] ?? 0),
        ];
    }

    /**
     * Count fully deleted duplicate file_keys.
     */
    public function countFullyDeletedDuplicates(): int
    {
        $result = Db::selectOne(
            "SELECT COUNT(*) as count
            FROM (
                SELECT file_key
                FROM magic_super_agent_task_files
                WHERE file_key IS NOT NULL
                  AND file_key != ''
                GROUP BY file_key
                HAVING COUNT(*) > 1
                   AND COUNT(*) = SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END)
            ) as subquery"
        );

        return (int) ($result['count'] ?? 0);
    }

    /**
     * Count duplicate directory file_keys.
     */
    public function countDirectoryDuplicates(): int
    {
        $result = Db::selectOne(
            "SELECT COUNT(*) as count
            FROM (
                SELECT file_key
                FROM magic_super_agent_task_files
                WHERE file_key IS NOT NULL
                  AND file_key != ''
                  AND is_directory = 1
                GROUP BY file_key
                HAVING COUNT(*) > 1
                   AND COUNT(*) > SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END)
            ) as subquery"
        );

        return (int) ($result['count'] ?? 0);
    }

    /**
     * Count duplicate file file_keys.
     */
    public function countFileDuplicates(): int
    {
        $result = Db::selectOne(
            "SELECT COUNT(*) as count
            FROM (
                SELECT file_key
                FROM magic_super_agent_task_files
                WHERE file_key IS NOT NULL
                  AND file_key != ''
                  AND is_directory = 0
                GROUP BY file_key
                HAVING COUNT(*) > 1
                   AND COUNT(*) > SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END)
            ) as subquery"
        );

        return (int) ($result['count'] ?? 0);
    }

    /**
     * Get distinct project_ids that have fully deleted duplicate file_keys.
     * Uses covering index optimization - only selects project_id.
     * OPTIMIZED: Replaced subquery with JOIN for better performance.
     */
    public function getProjectIdsWithFullyDeletedDuplicates(?string $fileKey = null): array
    {
        $whereConditions = ['t1.project_id IS NOT NULL', 't1.file_key IS NOT NULL', "t1.file_key != ''"];
        $params = [];

        if ($fileKey !== null) {
            $whereConditions[] = 't1.file_key = ?';
            $params[] = $fileKey;
        }

        $whereClause = implode(' AND ', $whereConditions);

        // OPTIMIZED: Use JOIN instead of subquery to avoid duplicate table scans
        $subqueryWhere = ['project_id IS NOT NULL', 'file_key IS NOT NULL', "file_key != ''"];
        $subqueryParams = [];
        if ($fileKey !== null) {
            $subqueryWhere[] = 'file_key = ?';
            $subqueryParams[] = $fileKey;
        }
        $subqueryWhereClause = implode(' AND ', $subqueryWhere);

        $results = Db::select(
            "SELECT DISTINCT t1.project_id
            FROM magic_super_agent_task_files t1
            INNER JOIN (
                SELECT project_id, file_key
                FROM magic_super_agent_task_files
                WHERE {$subqueryWhereClause}
                GROUP BY project_id, file_key
                HAVING COUNT(*) > 1
                   AND COUNT(*) = SUM(deleted_at IS NOT NULL)
            ) t2 ON t1.project_id = t2.project_id AND t1.file_key = t2.file_key
            WHERE {$whereClause}
            ORDER BY t1.project_id ASC",
            array_merge($subqueryParams, $params)
        );

        return array_column($results, 'project_id');
    }

    /**
     * Get fully deleted duplicate file_keys.
     *
     * OPTIMIZED: Uses covering index (project_id, file_key, deleted_at).
     * Only selects file_key to avoid table lookup.
     * Reduced GROUP BY complexity by filtering at project_id level first.
     *
     * PAGINATION STRATEGY: Fixed OFFSET=0 approach.
     * Always queries from OFFSET 0 because processed records are deleted.
     * After each batch is processed and deleted, the next query naturally returns the new first batch.
     * This avoids the "pagination offset drift" problem.
     */
    public function getFullyDeletedDuplicateKeys(int $limit, ?int $projectId = null, ?string $fileKey = null): array
    {
        $whereConditions = [];
        $params = [];

        // OPTIMIZATION: Put indexed columns (project_id) first for better index utilization
        if ($projectId !== null) {
            $whereConditions[] = 'project_id = ?';
            $params[] = $projectId;
        }

        $whereConditions[] = 'file_key IS NOT NULL';
        $whereConditions[] = "file_key != ''";

        if ($fileKey !== null) {
            $whereConditions[] = 'file_key = ?';
            $params[] = $fileKey;
        }

        $whereClause = implode(' AND ', $whereConditions);

        $params[] = $limit;

        // OPTIMIZED: Use covering index, avoid functions in WHERE/HAVING where possible
        // Simplified HAVING: use direct comparison instead of SUM(CASE WHEN...)
        $results = Db::select(
            "SELECT file_key
            FROM magic_super_agent_task_files
            WHERE {$whereClause}
            GROUP BY project_id, file_key
            HAVING COUNT(*) > 1
               AND COUNT(*) = SUM(deleted_at IS NOT NULL)
            ORDER BY file_key ASC
            LIMIT ?",
            $params
        );

        return array_column($results, 'file_key');
    }

    /**
     * Get distinct project_ids that have duplicate directory file_keys.
     * Uses covering index optimization - only selects project_id.
     * OPTIMIZED: Replaced subquery with JOIN for better performance.
     */
    public function getProjectIdsWithDirectoryDuplicates(?string $fileKey = null): array
    {
        $whereConditions = ['t1.project_id IS NOT NULL', 't1.file_key IS NOT NULL', "t1.file_key != ''", 't1.is_directory = 1'];
        $params = [];

        if ($fileKey !== null) {
            $whereConditions[] = 't1.file_key = ?';
            $params[] = $fileKey;
        }

        $whereClause = implode(' AND ', $whereConditions);

        // OPTIMIZED: Use JOIN instead of subquery to avoid duplicate table scans
        $subqueryWhere = ['project_id IS NOT NULL', 'file_key IS NOT NULL', "file_key != ''", 'is_directory = 1'];
        $subqueryParams = [];
        if ($fileKey !== null) {
            $subqueryWhere[] = 'file_key = ?';
            $subqueryParams[] = $fileKey;
        }
        $subqueryWhereClause = implode(' AND ', $subqueryWhere);

        $results = Db::select(
            "SELECT DISTINCT t1.project_id
            FROM magic_super_agent_task_files t1
            INNER JOIN (
                SELECT project_id, file_key
                FROM magic_super_agent_task_files
                WHERE {$subqueryWhereClause}
                GROUP BY project_id, file_key
                HAVING COUNT(*) > 1
                   AND COUNT(*) > SUM(deleted_at IS NOT NULL)
            ) t2 ON t1.project_id = t2.project_id AND t1.file_key = t2.file_key
            WHERE {$whereClause}
            ORDER BY t1.project_id ASC",
            array_merge($subqueryParams, $params)
        );

        return array_column($results, 'project_id');
    }

    /**
     * Get duplicate directory file_keys.
     *
     * OPTIMIZED: Uses covering index (project_id, is_directory, file_key, deleted_at).
     * Only selects file_key to avoid table lookup.
     * Reduced GROUP BY complexity by filtering at project_id level first.
     *
     * PAGINATION STRATEGY: Fixed OFFSET=0 approach.
     * Always queries from OFFSET 0 because processed records are deleted.
     * After each batch is processed and deleted, the next query naturally returns the new first batch.
     * This avoids the "pagination offset drift" problem.
     */
    public function getDirectoryDuplicateKeys(int $limit, ?int $projectId = null, ?string $fileKey = null): array
    {
        $whereConditions = [];
        $params = [];

        // OPTIMIZATION: Put indexed columns (project_id) first for better index utilization
        if ($projectId !== null) {
            $whereConditions[] = 'project_id = ?';
            $params[] = $projectId;
        }

        $whereConditions[] = 'file_key IS NOT NULL';
        $whereConditions[] = "file_key != ''";
        $whereConditions[] = 'is_directory = 1';

        if ($fileKey !== null) {
            $whereConditions[] = 'file_key = ?';
            $params[] = $fileKey;
        }

        $whereClause = implode(' AND ', $whereConditions);

        $params[] = $limit;

        // OPTIMIZED: Use covering index, avoid functions in WHERE/HAVING where possible
        // Simplified HAVING: use direct comparison instead of SUM(CASE WHEN...)
        $results = Db::select(
            "SELECT file_key
            FROM magic_super_agent_task_files
            WHERE {$whereClause}
            GROUP BY project_id, file_key
            HAVING COUNT(*) > 1
               AND COUNT(*) > SUM(deleted_at IS NOT NULL)
            ORDER BY file_key ASC
            LIMIT ?",
            $params
        );

        return array_column($results, 'file_key');
    }

    /**
     * Get distinct project_ids that have duplicate file file_keys.
     * Uses covering index optimization - only selects project_id.
     * OPTIMIZED: Replaced subquery with JOIN for better performance.
     */
    public function getProjectIdsWithFileDuplicates(?string $fileKey = null): array
    {
        $whereConditions = ['t1.project_id IS NOT NULL', 't1.file_key IS NOT NULL', "t1.file_key != ''", 't1.is_directory = 0'];
        $params = [];

        if ($fileKey !== null) {
            $whereConditions[] = 't1.file_key = ?';
            $params[] = $fileKey;
        }

        $whereClause = implode(' AND ', $whereConditions);

        // OPTIMIZED: Use JOIN instead of subquery to avoid duplicate table scans
        $subqueryWhere = ['project_id IS NOT NULL', 'file_key IS NOT NULL', "file_key != ''", 'is_directory = 0'];
        $subqueryParams = [];
        if ($fileKey !== null) {
            $subqueryWhere[] = 'file_key = ?';
            $subqueryParams[] = $fileKey;
        }
        $subqueryWhereClause = implode(' AND ', $subqueryWhere);

        $results = Db::select(
            "SELECT DISTINCT t1.project_id
            FROM magic_super_agent_task_files t1
            INNER JOIN (
                SELECT project_id, file_key
                FROM magic_super_agent_task_files
                WHERE {$subqueryWhereClause}
                GROUP BY project_id, file_key
                HAVING COUNT(*) > 1
                   AND COUNT(*) > SUM(deleted_at IS NOT NULL)
            ) t2 ON t1.project_id = t2.project_id AND t1.file_key = t2.file_key
            WHERE {$whereClause}
            ORDER BY t1.project_id ASC",
            array_merge($subqueryParams, $params)
        );

        return array_column($results, 'project_id');
    }

    /**
     * Get duplicate file file_keys.
     *
     * OPTIMIZED: Uses covering index (project_id, is_directory, file_key, deleted_at).
     * Only selects file_key to avoid table lookup.
     * Reduced GROUP BY complexity by filtering at project_id level first.
     *
     * PAGINATION STRATEGY: Fixed OFFSET=0 approach.
     * Always queries from OFFSET 0 because processed records are deleted.
     * After each batch is processed and deleted, the next query naturally returns the new first batch.
     * This avoids the "pagination offset drift" problem.
     */
    public function getFileDuplicateKeys(int $limit, ?int $projectId = null, ?string $fileKey = null): array
    {
        $whereConditions = [];
        $params = [];

        // OPTIMIZATION: Put indexed columns (project_id) first for better index utilization
        if ($projectId !== null) {
            $whereConditions[] = 'project_id = ?';
            $params[] = $projectId;
        }

        $whereConditions[] = 'file_key IS NOT NULL';
        $whereConditions[] = "file_key != ''";
        $whereConditions[] = 'is_directory = 0';

        if ($fileKey !== null) {
            $whereConditions[] = 'file_key = ?';
            $params[] = $fileKey;
        }

        $whereClause = implode(' AND ', $whereConditions);

        $params[] = $limit;

        // OPTIMIZED: Use covering index, avoid functions in WHERE/HAVING where possible
        // Simplified HAVING: use direct comparison instead of SUM(CASE WHEN...)
        $results = Db::select(
            "SELECT file_key
            FROM magic_super_agent_task_files
            WHERE {$whereClause}
            GROUP BY project_id, file_key
            HAVING COUNT(*) > 1
               AND COUNT(*) > SUM(deleted_at IS NOT NULL)
            ORDER BY file_key ASC
            LIMIT ?",
            $params
        );

        return array_column($results, 'file_key');
    }

    /**
     * Get all records by file_key, ordered by priority.
     */
    public function getRecordsByFileKey(string $fileKey): array
    {
        $results = Db::select(
            'SELECT *
            FROM magic_super_agent_task_files
            WHERE file_key = ?
            ORDER BY 
                CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END,
                CASE WHEN topic_id IS NOT NULL THEN 0 ELSE 1 END,
                CASE WHEN project_id IS NOT NULL THEN 0 ELSE 1 END,
                created_at ASC,
                file_id ASC',
            [$fileKey]
        );

        // Convert stdClass objects to arrays
        return array_map(fn ($record) => (array) $record, $results);
    }

    /**
     * Get all records for multiple file_keys, ordered by priority (optimized batch query).
     * Returns: ['file_key1' => [record1, record2, ...], 'file_key2' => [...], ...].
     *
     * OPTIMIZED: Uses covering index when project_id is provided.
     * Reduced CASE WHEN usage in ORDER BY for better performance.
     * OPTIMIZED: Only selects necessary columns to reduce data transfer and improve performance.
     */
    public function getRecordsByFileKeys(array $fileKeys, ?int $projectId = null): array
    {
        if (empty($fileKeys)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($fileKeys), '?'));
        $params = $fileKeys;

        $whereClause = "file_key IN ({$placeholders})";
        if ($projectId !== null) {
            $whereClause .= ' AND project_id = ?';
            $params[] = $projectId;
        }

        // OPTIMIZED: Only select necessary columns instead of SELECT *
        // Required fields: file_id, project_id, parent_id, deleted_at, file_key, file_name, is_directory, topic_id, updated_at, created_at
        $results = Db::select(
            "SELECT 
                file_id,
                project_id,
                parent_id,
                deleted_at,
                file_key,
                file_name,
                is_directory,
                topic_id,
                updated_at,
                created_at
            FROM magic_super_agent_task_files
            WHERE {$whereClause}
            ORDER BY 
                file_key,
                deleted_at IS NULL DESC,
                topic_id IS NULL ASC,
                project_id IS NULL ASC,
                created_at ASC,
                file_id ASC",
            $params
        );

        // Group results by file_key
        $grouped = [];
        foreach ($results as $record) {
            $recordArray = (array) $record;
            $fileKey = $recordArray['file_key'];
            if (! isset($grouped[$fileKey])) {
                $grouped[$fileKey] = [];
            }
            $grouped[$fileKey][] = $recordArray;
        }

        return $grouped;
    }

    /**
     * Update parent_id references for deleted file IDs.
     */
    public function updateParentIdReferences(int $keptFileId, array $deletedFileIds, int $projectId): int
    {
        if (empty($deletedFileIds)) {
            return 0;
        }

        $placeholders = implode(',', array_fill(0, count($deletedFileIds), '?'));

        return Db::update(
            "UPDATE magic_super_agent_task_files
            SET parent_id = ?
            WHERE parent_id IN ({$placeholders})
              AND project_id = ?
              AND deleted_at IS NULL",
            array_merge([$keptFileId], $deletedFileIds, [$projectId])
        );
    }

    /**
     * Delete records by file IDs.
     */
    public function deleteRecords(array $fileIds): int
    {
        if (empty($fileIds)) {
            return 0;
        }

        $placeholders = implode(',', array_fill(0, count($fileIds), '?'));

        return Db::delete(
            "DELETE FROM magic_super_agent_task_files WHERE file_id IN ({$placeholders})",
            $fileIds
        );
    }

    /**
     * Count remaining duplicate file_keys.
     */
    public function countRemainingDuplicates(): int
    {
        $result = Db::selectOne(
            "SELECT COUNT(*) as count
            FROM (
                SELECT file_key
                FROM magic_super_agent_task_files
                WHERE file_key IS NOT NULL
                  AND file_key != ''
                GROUP BY file_key
                HAVING COUNT(*) > 1
            ) as subquery"
        );

        return (int) ($result['count'] ?? 0);
    }

    /**
     * Get file_keys with inconsistent is_directory values.
     */
    public function getInconsistentDirectoryFlags(): array
    {
        $results = Db::select(
            "SELECT 
                file_key,
                GROUP_CONCAT(DISTINCT is_directory ORDER BY is_directory) as is_directory_values,
                COUNT(*) as record_count
            FROM magic_super_agent_task_files
            WHERE file_key IS NOT NULL AND file_key != ''
            GROUP BY file_key
            HAVING COUNT(DISTINCT is_directory) > 1"
        );

        return array_map(function ($row) {
            return [
                'file_key' => $row['file_key'],
                'is_directory_values' => $row['is_directory_values'],
                'record_count' => (int) $row['record_count'],
            ];
        }, $results);
    }

    /**
     * Fix is_directory flag for all records of a file_key.
     */
    public function fixDirectoryFlag(string $fileKey, int $correctIsDirectory): int
    {
        return Db::update(
            'UPDATE magic_super_agent_task_files 
            SET is_directory = ? 
            WHERE file_key = ?',
            [$correctIsDirectory, $fileKey]
        );
    }
}
