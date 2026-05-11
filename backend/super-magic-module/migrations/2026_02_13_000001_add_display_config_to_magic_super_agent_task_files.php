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
        if (! Schema::hasTable('magic_super_agent_task_files')) {
            return;
        }

        if (Schema::hasColumn('magic_super_agent_task_files', 'display_config')) {
            return;
        }

        Schema::table('magic_super_agent_task_files', static function (Blueprint $table) {
            $table->text('display_config')
                ->nullable()
                ->after('metadata')
                ->comment('Display config for frontend, stored as JSON');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('magic_super_agent_task_files')) {
            return;
        }
        if (! Schema::hasColumn('magic_super_agent_task_files', 'display_config')) {
            return;
        }
        Schema::table('magic_super_agent_task_files', static function (Blueprint $table) {
            $table->dropColumn('display_config');
        });
    }
};
