<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddIsHiddenAndHiddenTypeToMagicSuperAgentProjectsTable extends Migration
{
    public function up(): void
    {
        Schema::table('magic_super_agent_project', function (Blueprint $table) {
            $table->boolean('is_hidden')->default(false)->after('source')->comment('是否隐藏，隐藏则接口列表不返回');
            $table->tinyInteger('hidden_type')->nullable()->after('is_hidden')->comment('隐藏类型：1-预启动隐藏');

            // 添加索引以提高查询性能
            $table->index(['workspace_id', 'user_id', 'is_hidden', 'hidden_type'], 'idx_workspace_user_hidden');
        });
    }

    public function down(): void
    {
        Schema::table('magic_super_agent_project', function (Blueprint $table) {
            $table->dropIndex('idx_workspace_user_hidden');
            $table->dropColumn(['is_hidden', 'hidden_type']);
        });
    }
}
