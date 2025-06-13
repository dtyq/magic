<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Check if table exists before performing index operations
        if (!Schema::hasTable('magic_super_agent_message')) {
            return;
        }

        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            // Check if idx_message_id index exists before creating
            if (!Schema::hasIndex('magic_super_agent_message', 'idx_message_id')) {
                $table->index(['message_id'], 'idx_message_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('magic_super_agent_message')) {
            return;
        }
    }

    /**
     * 检查索引是否存在，如果不存在则创建索引.
     *
     * @param string $table 表名
     * @param string $indexName 索引名称
     * @param string $createStatement 创建索引的SQL语句
     */
    private function createIndexIfNotExists(string $table, string $indexName, string $createStatement): void
    {
        // 检查索引是否存在
        $indexExists = Db::select(
            "SHOW INDEX FROM `{$table}` WHERE Key_name = ?",
            [$indexName]
        );

        // 只有当索引不存在时才创建
        if (empty($indexExists)) {
            // 创建索引
            Db::statement($createStatement);
        }
    }

    /**
     * 如果索引存在则删除.
     *
     * @param string $table 表名
     * @param string $indexName 索引名称
     */
    private function dropIndexIfExists(string $table, string $indexName): void
    {
        // 检查索引是否存在
        $indexExists = Db::select(
            "SHOW INDEX FROM `{$table}` WHERE Key_name = ?",
            [$indexName]
        );

        if (! empty($indexExists)) {
            // 删除现有索引
            Db::statement("DROP INDEX `{$indexName}` ON `{$table}`");
        }
    }
}; 