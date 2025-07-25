<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * 文件排序功能数据库优化迁移
 * 添加排序相关的复合索引和数据初始化
 */
return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. 添加复合索引以优化排序查询性能
        Schema::table('magic_super_agent_task_files', function (Blueprint $table) {
            // 为项目文件查询添加复合索引 (project_id, parent_id, sort, file_id)
            // 这个索引将大大提升按项目和父目录分组的排序查询性能
            $table->index(['project_id', 'parent_id', 'sort', 'file_id'], 'idx_project_parent_sort');

            // 为话题文件查询添加复合索引 (topic_id, parent_id, sort, file_id)
            // 这个索引将优化按话题和父目录分组的排序查询性能
            $table->index(['topic_id', 'parent_id', 'sort', 'file_id'], 'idx_topic_parent_sort');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_task_files', function (Blueprint $table) {
            // 删除添加的索引
            $table->dropIndex('idx_project_parent_sort');
            $table->dropIndex('idx_topic_parent_sort');
        });
    }
};
