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
        // 为 magic_super_agent_project 表增加 project_mode 字段
        Schema::table('magic_super_agent_project', function (Blueprint $table) {
            if (Schema::hasColumn('magic_super_agent_project', 'project_mode')) {
                return;
            }
            $table->string('project_mode', 50)->nullable()->default(null)->comment('项目模式: general-通用模式, ppt-PPT模式, data_analysis-数据分析模式, report-研报模式')->after('current_topic_status');
        });

        echo '为项目表添加项目模式字段完成' . PHP_EOL;
    }

    /**
     * 回滚迁移.
     */
    public function down(): void
    {
        // 删除 magic_super_agent_project 表的 project_mode 字段
        Schema::table('magic_super_agent_project', function (Blueprint $table) {
            $table->dropColumn('project_mode');
        });

        echo '删除项目表的项目模式字段完成' . PHP_EOL;
    }
};
