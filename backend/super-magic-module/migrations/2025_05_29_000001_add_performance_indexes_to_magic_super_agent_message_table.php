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
        if (!Schema::hasTable('magic_super_agent_message')) {
            return;
        }

        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            // Check if idx_id index exists
            if (!Schema::hasIndex('magic_super_agent_message', 'idx_id')) {
                $table->index(['id'], 'idx_id');
            }

            // Check if idx_topic_show_deleted index exists
            if (!Schema::hasIndex('magic_super_agent_message', 'idx_topic_show_deleted')) {
                $table->index(['topic_id', 'show_in_ui', 'deleted_at'], 'idx_topic_show_deleted');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('magic_super_agent_message')) {
            return;
        }

        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            // Drop indexes if they exist
            if (Schema::hasIndex('magic_super_agent_message', 'idx_id')) {
                $table->dropIndex('idx_id');
            }

            if (Schema::hasIndex('magic_super_agent_message', 'idx_topic_show_deleted')) {
                $table->dropIndex('idx_topic_show_deleted');
            }
        });
    }
}; 