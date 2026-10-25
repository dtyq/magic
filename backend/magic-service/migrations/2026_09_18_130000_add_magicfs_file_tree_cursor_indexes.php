<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Exception\QueryException;
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    private string $indexName = 'idx_magicfs_file_tree_parent_cursor';

    public function up(): void
    {
        $tableName = 'magic_super_agent_task_files';
        if (! $this->tableExists($tableName) || $this->indexExists($tableName, $this->indexName)) {
            return;
        }

        try {
            Schema::table($tableName, function (Blueprint $table): void {
                // A parent_id is the file-tree edge.  It remains authoritative
                // when a directory moves between projects, so the hot listing
                // query must be able to seek by parent and keyset position
                // without consulting denormalized project/space columns.
                $table->index(
                    ['parent_id', 'deleted_at', 'sort', 'file_id'],
                    $this->indexName
                );
            });
        } catch (QueryException $exception) {
            // Another pod may have created the index after the existence check.
            // Re-check the post-condition and preserve any real DDL failure.
            if (! $this->tableExists($tableName) || ! $this->indexExists($tableName, $this->indexName)) {
                throw $exception;
            }
        }
    }

    public function down(): void
    {
        $tableName = 'magic_super_agent_task_files';
        if (! $this->tableExists($tableName) || ! $this->indexExists($tableName, $this->indexName)) {
            return;
        }

        try {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->dropIndex($this->indexName);
            });
        } catch (QueryException $exception) {
            // Treat a concurrently completed rollback as success.
            if ($this->tableExists($tableName) && $this->indexExists($tableName, $this->indexName)) {
                throw $exception;
            }
        }
    }

    /** @phpstan-impure */
    private function tableExists(string $tableName): bool
    {
        return Schema::hasTable($tableName);
    }

    /** @phpstan-impure */
    private function indexExists(string $tableName, string $indexName): bool
    {
        return Schema::hasIndex($tableName, $indexName);
    }
};
