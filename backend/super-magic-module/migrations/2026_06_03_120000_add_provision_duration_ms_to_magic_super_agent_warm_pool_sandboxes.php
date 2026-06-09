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

        if (! Schema::hasColumn($this->table, 'provision_duration_ms')) {
            Schema::table($this->table, function (Blueprint $table) {
                // Wall-clock time (in milliseconds) from kicking off sandbox
                // creation to the row flipping to `ready`. Recorded purely for
                // debugging / observability of warm-pool provisioning latency.
                $table->unsignedInteger('provision_duration_ms')
                    ->nullable()
                    ->after('status')
                    ->comment('从开始创建沙箱到 ready 的耗时（毫秒），用于调试');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable($this->table)) {
            return;
        }

        if (Schema::hasColumn($this->table, 'provision_duration_ms')) {
            Schema::table($this->table, function (Blueprint $table) {
                $table->dropColumn('provision_duration_ms');
            });
        }
    }
};
