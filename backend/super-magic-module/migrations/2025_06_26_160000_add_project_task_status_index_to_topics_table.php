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
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            // 添加复合索引：project_id + current_task_status + deleted_at
            // 用于优化根据项目ID查询运行中话题的性能
            $table->index(['project_id', 'current_task_status', 'deleted_at'], 'idx_project_task_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            $table->dropIndex('idx_project_task_status');
        });
    }
};
