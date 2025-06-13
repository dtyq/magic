<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddUniqueIndexToTokenUsageRecords extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_super_agent_token_usage_records', function (Blueprint $table) {
            // Add unique composite index for idempotency
            $table->unique(['topic_id', 'task_id', 'sandbox_id', 'model_id'], 'idx_token_usage_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_token_usage_records', function (Blueprint $table) {
            // Drop the unique index
            $table->dropUnique('idx_token_usage_unique');
        });
    }
}
