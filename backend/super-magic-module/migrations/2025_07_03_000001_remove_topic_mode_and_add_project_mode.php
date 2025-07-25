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
        // 为 magic_super_agent_project 表添加 project_mode 字段
        Schema::table('magic_super_agent_project', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_super_agent_project', 'project_mode')) {
                $table->string('project_mode', 50)->nullable()->default('')->comment('项目模式: general-通用模式, ppt-PPT模式, data_analysis-数据分析模式, report-研报模式, meeting-会议模式, summary-总结模式, super_magic-超级麦吉模式')->after('current_topic_status');
            }
        });

        echo '删除话题模式字段并添加项目模式字段完成' . PHP_EOL;
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
