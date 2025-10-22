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
        $tableName = 'magic_super_agent_task';
        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            // Add composite index for topic_id and deleted_at
            if (! Schema::hasIndex($tableName, 'idx_topic_deleted')) {
                $table->index(['topic_id', 'deleted_at'], 'idx_topic_deleted');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
