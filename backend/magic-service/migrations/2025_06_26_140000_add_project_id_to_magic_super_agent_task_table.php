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
        if (Schema::hasTable('magic_super_agent_task')) {
            Schema::table('magic_super_agent_task', function (Blueprint $table) {
                // 在 workspace_id 后添加 project_id 字段
                if (! Schema::hasColumn('magic_super_agent_task', 'project_id')) {
                    $table->unsignedBigInteger('project_id')->default(0)->after('workspace_id')->comment('项目ID');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('magic_super_agent_task')) {
            Schema::table('magic_super_agent_task', function (Blueprint $table) {
                // 删除 project_id 字段（索引随列一并删除）
                if (Schema::hasColumn('magic_super_agent_task', 'project_id')) {
                    $table->dropColumn('project_id');
                }
            });
        }
    }
};
