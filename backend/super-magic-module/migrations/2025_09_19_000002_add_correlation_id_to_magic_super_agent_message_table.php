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
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            // Add correlation_id field for message correlation tracking
            $table->string('correlation_id', 128)->nullable()->comment('关联ID，用于消息追踪和关联');

            // Add index for performance optimization
            $table->index(['correlation_id'], 'idx_correlation_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex('idx_correlation_id');
            // Drop the column
            $table->dropColumn('correlation_id');
        });
    }
};
