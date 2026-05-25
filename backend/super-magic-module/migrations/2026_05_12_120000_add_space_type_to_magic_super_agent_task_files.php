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
        if (Schema::hasTable('magic_super_agent_task_files')
            && ! Schema::hasColumn('magic_super_agent_task_files', 'space_type')
        ) {
            Schema::table('magic_super_agent_task_files', function (Blueprint $table) {
                $table->string('space_type', 32)->default('project')->after('metadata_version')
                    ->comment('文件所属空间类型：project-项目，user-用户');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('magic_super_agent_task_files')
            && Schema::hasColumn('magic_super_agent_task_files', 'space_type')
        ) {
            Schema::table('magic_super_agent_task_files', function (Blueprint $table) {
                $table->dropColumn('space_type');
            });
        }
    }
};
