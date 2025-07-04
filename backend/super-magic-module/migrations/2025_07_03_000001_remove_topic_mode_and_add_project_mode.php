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
        // 删除 magic_super_agent_topics 表的 topic_mode 字段
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            if (Schema::hasColumn('magic_super_agent_topics', 'topic_mode')) {
                $table->dropColumn('topic_mode');
            }
        });

        // 为 magic_super_agent_project 表添加 project_mode 字段
        Schema::table('magic_super_agent_project', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_super_agent_project', 'project_mode')) {
                $table->string('project_mode', 50)->nullable()->default('')->comment('项目模式: general-通用模式, ppt-PPT模式, data_analysis-数据分析模式, report-研报模式')->after('current_topic_status');
            }
        });

        echo '删除话题模式字段并添加项目模式字段完成' . PHP_EOL;
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // 恢复 magic_super_agent_topics 表的 topic_mode 字段
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_super_agent_topics', 'topic_mode')) {
                $table->string('topic_mode', 50)->default('general')->comment('话题模式: general-通用, presentation-PPT, data_analysis-数据分析, document-文档')->after('current_task_status');
            }
        });

        // 删除 magic_super_agent_project 表的 project_mode 字段
        Schema::table('magic_super_agent_project', function (Blueprint $table) {
            if (Schema::hasColumn('magic_super_agent_project', 'project_mode')) {
                $table->dropColumn('project_mode');
            }
        });

        echo '恢复话题模式字段并删除项目模式字段完成' . PHP_EOL;
    }
};
