<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddHiddenTypeToMagicSuperAgentTopicsTable extends Migration
{
    public function up(): void
    {
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            $table->tinyInteger('hidden_type')->nullable()->after('is_hidden')->comment('隐藏类型：1-预启动隐藏');

            // 添加索引以提高查询性能
            $table->index(['project_id', 'user_id', 'is_hidden', 'hidden_type'], 'idx_project_user_hidden');
        });
    }

    public function down(): void
    {
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            $table->dropIndex('idx_project_user_hidden');
            $table->dropColumn('hidden_type');
        });
    }
}
