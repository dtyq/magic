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
                // 为 sandbox_id 字段添加索引
                if (! Schema::hasIndex('magic_super_agent_topics', 'idx_sandbox_id')) {
                    $table->index('sandbox_id', 'idx_sandbox_id');
                }
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
                // 删除 sandbox_id 索引
                try {
                    $table->dropIndex('idx_sandbox_id');
                } catch (Exception $e) {
                    // 索引可能不存在，忽略错误
                }
            });
        }
    }
};
