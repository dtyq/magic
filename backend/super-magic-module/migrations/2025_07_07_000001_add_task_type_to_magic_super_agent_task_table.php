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
        if (! Schema::hasTable('magic_super_agent_task')) {
            return;
        }

        Schema::table('magic_super_agent_task', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_super_agent_task', 'task_type')) {
                $table->string('task_type', 50)
                    ->default('agent')
                    ->comment('任务类型：agent-智能体任务，tool-工具任务，custom-自定义任务')
                    ->after('task_status');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('magic_super_agent_task')) {
            Schema::table('magic_super_agent_task', function (Blueprint $table) {
                if (Schema::hasColumn('magic_super_agent_task', 'task_type')) {
                    $table->dropColumn('task_type');
                }
            });
        }
    }
};
