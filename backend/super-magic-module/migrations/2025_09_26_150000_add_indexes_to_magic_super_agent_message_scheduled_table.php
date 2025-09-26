<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddIndexesToMagicSuperAgentMessageScheduledTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_super_agent_message_scheduled', function (Blueprint $table) {
            // 1. 主要查询索引（覆盖基础查询 + 排序优化）
            // 用途：user_id + organization_code + deleted_at + updated_at 排序
            $table->index(['user_id', 'organization_code', 'deleted_at', 'updated_at'], 'idx_user_org_deleted_updated');

            // 2. 工作区查询索引
            // 用途：workspace_id + user_id + organization_code + deleted_at 筛选
            $table->index(['workspace_id', 'user_id', 'organization_code', 'deleted_at'], 'idx_workspace_user_org_deleted');

            // 3. 项目查询索引
            // 用途：project_id + user_id + organization_code + deleted_at 筛选
            $table->index(['project_id', 'user_id', 'organization_code', 'deleted_at'], 'idx_project_user_org_deleted');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
}
