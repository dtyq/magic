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
        // 添加目录管理相关字段到 magic_super_agent_task_files 表
        if (Schema::hasTable('magic_super_agent_task_files')) {
            Schema::table('magic_super_agent_task_files', function (Blueprint $table) {
                // 添加 is_directory 字段 - 是否为目录
                if (! Schema::hasColumn('magic_super_agent_task_files', 'is_directory')) {
                    $table->tinyInteger('is_directory')->default(0)->comment('是否为目录：0-否，1-是');
                }

                // 添加 sort 字段 - 排序字段
                if (! Schema::hasColumn('magic_super_agent_task_files', 'sort')) {
                    $table->bigInteger('sort')->default(0)->comment('排序字段');
                }

                // 添加 parent_id 字段 - 父级ID
                if (! Schema::hasColumn('magic_super_agent_task_files', 'parent_id')) {
                    $table->unsignedBigInteger('parent_id')->nullable()->comment('父级ID');
                }

                // 添加 source 字段 - 来源字段
                if (! Schema::hasColumn('magic_super_agent_task_files', 'source')) {
                    $table->tinyInteger('source')->default(0)->comment('来源字段：1-首页，2-项目目录，3-agent');
                }

                // 添加索引
                $table->index('parent_id', 'idx_parent_id');
                $table->index('source', 'idx_source');
                $table->index('sort', 'idx_sort');
                $table->index('is_directory', 'idx_is_directory');
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
                // 删除索引
                try {
                    $table->dropIndex('idx_parent_id');
                    $table->dropIndex('idx_source');
                    $table->dropIndex('idx_sort');
                    $table->dropIndex('idx_is_directory');
                } catch (Exception $e) {
                    // 索引可能不存在，忽略错误
                }

                // 删除字段
                if (Schema::hasColumn('magic_super_agent_task_files', 'is_directory')) {
                    $table->dropColumn('is_directory');
                }

                if (Schema::hasColumn('magic_super_agent_task_files', 'sort')) {
                    $table->dropColumn('sort');
                }

                if (Schema::hasColumn('magic_super_agent_task_files', 'parent_id')) {
                    $table->dropColumn('parent_id');
                }

                if (Schema::hasColumn('magic_super_agent_task_files', 'source')) {
                    $table->dropColumn('source');
                }
            });
        }
    }
};
