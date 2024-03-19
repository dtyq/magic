<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * Optimize magic_super_agent_task table indexes.
 *
 * Changes:
 * - Remove unused indexes (4):
 *   - idx_created_status_user: Poor design, created_at as first column makes subsequent columns unusable
 *   - idx_user_created_deleted: No usage scenario found in codebase
 *   - idx_user_started_deleted: No usage scenario found in codebase
 *   - idx_user_finished_deleted: No usage scenario found in codebase
 *
 * - Add new index (1):
 *   - idx_task_status: For crontab task querying running/waiting status
 */
return new class extends Migration {
    private const TABLE_NAME = 'magic_super_agent_task';

    /**
     * Indexes to be removed.
     */
    private const INDEXES_TO_DROP = [
        'idx_created_status_user',
        'idx_user_created_deleted',
        'idx_user_started_deleted',
        'idx_user_finished_deleted',
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table(self::TABLE_NAME, function (Blueprint $table) {
            // Step 1: Safely drop unused indexes
            foreach (self::INDEXES_TO_DROP as $indexName) {
                if ($this->indexExists(self::TABLE_NAME, $indexName)) {
                    $table->dropIndex($indexName);
                }
            }

            // Step 2: Add new index for task status queries
            if (! $this->indexExists(self::TABLE_NAME, 'idx_task_status')) {
                $table->index(['task_status'], 'idx_task_status');
            }
        });
    }

    /**
     * Reverse the migrations.
     * Note: Rollback is handled by external audit system, not by script.
     */
    public function down(): void
    {
    }

    /**
     * Check if an index exists on the table.
     */
    private function indexExists(string $tableName, string $indexName): bool
    {
        $indexes = Schema::getConnection()
            ->getDoctrineSchemaManager()
            ->listTableIndexes($tableName);

        return isset($indexes[$indexName]);
    }
};
