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

        Schema::table('magic_super_agent_task_files', static function (Blueprint $table) {
            // Drop old normal index
            // $table->dropIndex('idx_file_key');

            // Add unique index for file_key
            // After cleanup, file_key should be unique across the table
            // $table->unique('file_key', 'unique_file_key');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
