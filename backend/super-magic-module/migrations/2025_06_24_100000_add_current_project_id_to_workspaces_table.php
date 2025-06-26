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
     * 运行迁移.
     */
    public function up(): void
    {
        // 为 magic_super_agent_workspaces 表增加 current_project_id 字段
        Schema::table('magic_super_agent_workspaces', function (Blueprint $table) {
            $table->bigInteger('current_project_id')->nullable()->comment('当前项目ID')->after('current_topic_id');
        });

        echo '为工作区表添加当前项目ID字段完成' . PHP_EOL;
    }

    /**
     * 回滚迁移.
     */
    public function down(): void
    {
        // 删除 magic_super_agent_workspaces 表的 current_project_id 字段
        Schema::table('magic_super_agent_workspaces', function (Blueprint $table) {
            $table->dropColumn('current_project_id');
        });

        echo '删除工作区表的当前项目ID字段完成' . PHP_EOL;
    }
};
