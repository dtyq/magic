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
        // 1. 重命名表
        if (Schema::hasTable('magic_super_agent_task_files') && ! Schema::hasTable('magic_super_agent_project_files')) {
            Schema::rename('magic_super_agent_task_files', 'magic_super_agent_project_files');
        }

        // 2. 修改表结构
        if (Schema::hasTable('magic_super_agent_project_files')) {
            Schema::table('magic_super_agent_project_files', function (Blueprint $table) {
                // 检查并删除 menu 字段
                if (Schema::hasColumn('magic_super_agent_project_files', 'menu')) {
                    $table->dropColumn('menu');
                }

                // 在 topic_id 前添加 project_id 字段
                if (! Schema::hasColumn('magic_super_agent_project_files', 'project_id')) {
                    $table->unsignedBigInteger('project_id')->after('file_id')->comment('项目ID');
                }

                // 删除原有的 topic_id 索引
                try {
                    $table->dropIndex('idx_topic_id');
                } catch (Exception $e) {
                    // 索引可能不存在，忽略错误
                }

                // 添加新索引
                $table->index('project_id', 'idx_project_id');
                $table->index('topic_id', 'idx_topic_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // 回滚时需要先删除新增的字段和索引，然后重命名表
        if (Schema::hasTable('magic_super_agent_project_files')) {
            Schema::table('magic_super_agent_project_files', function (Blueprint $table) {
                // 删除新增的索引
                try {
                    $table->dropIndex('idx_project_id');
                } catch (Exception $e) {
                    // 索引可能不存在，忽略错误
                }

                // 删除 project_id 字段
                if (Schema::hasColumn('magic_super_agent_project_files', 'project_id')) {
                    $table->dropColumn('project_id');
                }
            });

            // 重命名表回原名
            Schema::rename('magic_super_agent_project_files', 'magic_super_agent_task_files');
        }
    }
};
