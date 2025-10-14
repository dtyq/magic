<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddCollaborationEnabledToMagicSuperAgentProjectTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_super_agent_project', function (Blueprint $table) {
            // 添加协作功能开关字段
            $table->tinyInteger('is_collaboration_enabled')
                ->default(0)
                ->comment('是否开启协作功能（0=关闭，1=开启）')
                ->after('project_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_project', function (Blueprint $table) {
            // 删除协作功能开关字段
            $table->dropColumn('is_collaboration_enabled');
        });
    }
}
