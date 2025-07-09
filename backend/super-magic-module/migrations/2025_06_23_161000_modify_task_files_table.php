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
        // 修改 magic_super_agent_task_files 表结构
        if (Schema::hasTable('magic_super_agent_task_files')) {
            Schema::table('magic_super_agent_task_files', function (Blueprint $table) {
                // 检查并删除 menu 字段
                if (Schema::hasColumn('magic_super_agent_task_files', 'menu')) {
                    $table->dropColumn('menu');
                }

                // 在 topic_id 前添加 project_id 字段
                if (! Schema::hasColumn('magic_super_agent_task_files', 'project_id')) {
                    $table->unsignedBigInteger('project_id')->after('file_id')->comment('项目ID');
                }

                // 添加新索引
                $table->index('project_id', 'idx_project_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // 回滚操作
        if (Schema::hasTable('magic_super_agent_task_files')) {
            Schema::table('magic_super_agent_task_files', function (Blueprint $table) {
                // 删除新增的索引
                try {
                    $table->dropIndex('idx_project_id');
                } catch (Exception $e) {
                    // 索引可能不存在，忽略错误
                }

                // 删除 project_id 字段
                if (Schema::hasColumn('magic_super_agent_task_files', 'project_id')) {
                    $table->dropColumn('project_id');
                }

                // 恢复 menu 字段（如果需要的话）
                if (! Schema::hasColumn('magic_super_agent_task_files', 'menu')) {
                    $table->string('menu')->nullable()->comment('菜单');
                }
            });
        }
    }
};
