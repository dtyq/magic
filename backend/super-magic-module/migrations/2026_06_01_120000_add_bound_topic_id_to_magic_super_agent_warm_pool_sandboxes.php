<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    private string $table = 'magic_super_agent_warm_pool_sandboxes';

    public function up(): void
    {
        if (! Schema::hasTable($this->table)) {
            return;
        }

        if (! Schema::hasColumn($this->table, 'bound_topic_id')) {
            Schema::table($this->table, function (Blueprint $table) {
                // Stamped at claim time alongside bound_user_id / bound_project_id
                // so a warm-pool sandbox can be traced back to the topic that
                // claimed it.
                $table->string('bound_topic_id', 64)
                    ->nullable()
                    ->after('bound_project_id')
                    ->comment('被 claim 时的 topic_id（用于 trace）');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable($this->table)) {
            return;
        }

        if (Schema::hasColumn($this->table, 'bound_topic_id')) {
            Schema::table($this->table, function (Blueprint $table) {
                $table->dropColumn('bound_topic_id');
            });
        }
    }
};
