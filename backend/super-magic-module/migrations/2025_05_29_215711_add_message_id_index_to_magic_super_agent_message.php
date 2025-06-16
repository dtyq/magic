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
        // Check if table exists before performing index operations
        if (!Schema::hasTable('magic_super_agent_message')) {
            return;
        }

        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            // Check if idx_message_id index exists before creating
            if (!Schema::hasIndex('magic_super_agent_message', 'idx_message_id')) {
                $table->index(['message_id'], 'idx_message_id');
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
            // Check if idx_message_id index exists before dropping
            if (Schema::hasIndex('magic_super_agent_message', 'idx_message_id')) {
                $table->dropIndex('idx_message_id');
            }
        });
    }
};
