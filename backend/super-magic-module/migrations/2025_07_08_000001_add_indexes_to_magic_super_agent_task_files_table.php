<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tableName = 'magic_super_agent_task_files';
        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            if (! Schema::hasIndex($tableName, 'idx_project_hidden_deleted')) {
                $table->index(['project_id', 'is_hidden', 'deleted_at'], 'idx_project_hidden_deleted');
            }
            if (! Schema::hasIndex($tableName, 'idx_topic_storage_deleted')) {
                $table->index(['topic_id', 'storage_type', 'deleted_at'], 'idx_topic_storage_deleted');
            }
            if (! Schema::hasIndex($tableName, 'idx_topic_hidden_deleted')) {
                $table->index(['topic_id', 'is_hidden', 'deleted_at'], 'idx_topic_hidden_deleted');
            }
            if (! Schema::hasIndex($tableName, 'idx_topic_file_key')) {
                $table->index(['topic_id', 'file_key'], 'idx_topic_file_key');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tableName = 'magic_super_agent_task_files';
        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            if (Schema::hasIndex($tableName, 'idx_project_hidden_deleted')) {
                $table->dropIndex('idx_project_hidden_deleted');
            }
            if (Schema::hasIndex($tableName, 'idx_topic_storage_deleted')) {
                $table->dropIndex('idx_topic_storage_deleted');
            }
            if (Schema::hasIndex($tableName, 'idx_topic_hidden_deleted')) {
                $table->dropIndex('idx_topic_hidden_deleted');
            }
            if (Schema::hasIndex($tableName, 'idx_topic_file_key')) {
                $table->dropIndex('idx_topic_file_key');
            }
        });
    }
};
