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

        if (! Schema::hasColumn($this->table, 'env')) {
            Schema::table($this->table, function (Blueprint $table) {
                // Logical environment tag. All warm-pool queries (refill /
                // evict / image-shift / claim / drain) are scoped by this
                // column so multiple environments (pre/prod/...) can share
                // the same table without ripping out each other's rows.
                $table->string('env', 32)
                    ->default('default')
                    ->after('agent_image')
                    ->comment('逻辑环境标签，同表区分 pre/prod 等独立池');
            });
        }

        Schema::table($this->table, function (Blueprint $table) {
            // Replace the existing single-tenant indexes with env-prefixed
            // composites so the planner can keep using them while still
            // filtering by env. Drop-if-exists guards against partially
            // applied migrations.
            try {
                $table->dropIndex('idx_status_image');
            } catch (Throwable) {
            }
            try {
                $table->dropIndex('idx_expires');
            } catch (Throwable) {
            }

            $table->index(['env', 'status', 'agent_image'], 'idx_env_status_image');
            $table->index(['env', 'expires_at'], 'idx_env_expires');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable($this->table)) {
            return;
        }

        Schema::table($this->table, function (Blueprint $table) {
            try {
                $table->dropIndex('idx_env_status_image');
            } catch (Throwable) {
            }
            try {
                $table->dropIndex('idx_env_expires');
            } catch (Throwable) {
            }

            $table->index(['status', 'agent_image'], 'idx_status_image');
            $table->index('expires_at', 'idx_expires');

            if (Schema::hasColumn($this->table, 'env')) {
                $table->dropColumn('env');
            }
        });
    }
};
