<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Exception\QueryException;
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * Indexes for the two bounded metadata primitives used by MagicFS:
 *
 *  - exact parent/name lookup while resolving a path component;
 *
 * The cursor index added in the previous migration ends in (sort,file_id).
 * It is ideal for page walks but cannot seek efficiently when file_name is the
 * only child predicate, hence the separate parent/name key.
 */
return new class extends Migration {
    /** @var array<string, array<int, string>> */
    private array $indexes = [
        'idx_magicfs_file_tree_parent_name' => [
            'parent_id', 'file_name', 'deleted_at', 'file_id',
        ],
    ];

    public function up(): void
    {
        $tableName = 'magic_super_agent_task_files';
        if (! $this->tableExists($tableName)) {
            return;
        }

        foreach ($this->indexes as $name => $columns) {
            if ($this->indexExists($tableName, $name)) {
                continue;
            }

            try {
                Schema::table($tableName, static function (Blueprint $table) use ($columns, $name): void {
                    $table->index($columns, $name);
                });
            } catch (QueryException $exception) {
                // Another pod may have created this index after the existence check.
                // Re-check the post-condition and preserve any real DDL failure.
                if (! $this->tableExists($tableName) || ! $this->indexExists($tableName, $name)) {
                    throw $exception;
                }
            }
        }
    }

    public function down(): void
    {
        $tableName = 'magic_super_agent_task_files';
        if (! $this->tableExists($tableName)) {
            return;
        }

        foreach (array_keys($this->indexes) as $name) {
            if (! $this->indexExists($tableName, $name)) {
                continue;
            }

            try {
                Schema::table($tableName, static function (Blueprint $table) use ($name): void {
                    $table->dropIndex($name);
                });
            } catch (QueryException $exception) {
                // Treat a concurrently completed rollback as success.
                if ($this->tableExists($tableName) && $this->indexExists($tableName, $name)) {
                    throw $exception;
                }
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
