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
        if (Schema::hasTable('magic_super_agent_topics')) {
            Schema::table('magic_super_agent_topics', function (Blueprint $table) {
                // 在 workspace_id 后添加 project_id 字段
                if (!Schema::hasColumn('magic_super_agent_topics', 'project_id')) {
                    $table->unsignedBigInteger('project_id')->default(0)->after('workspace_id')->comment('项目ID');
                }
                
                // 添加项目ID索引
                $table->index('project_id', 'idx_project_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('magic_super_agent_topics')) {
            Schema::table('magic_super_agent_topics', function (Blueprint $table) {
                // 删除项目ID索引
                try {
                    $table->dropIndex('idx_project_id');
                } catch (Exception $e) {
                    // 索引可能不存在，忽略错误
                }
                
                // 删除 project_id 字段
                if (Schema::hasColumn('magic_super_agent_topics', 'project_id')) {
                    $table->dropColumn('project_id');
                }
            });
        }
    }
};