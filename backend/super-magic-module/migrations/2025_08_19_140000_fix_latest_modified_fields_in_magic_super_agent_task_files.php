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
        Schema::table('magic_super_agent_task_files', function (Blueprint $table) {
            // Remove the incorrect timestamp columns
            $table->dropColumn('latest_modified_topic_id');
            $table->dropColumn('latest_modified_task_id');
        });

        Schema::table('magic_super_agent_task_files', function (Blueprint $table) {
            // Add the correct bigint columns
            $table->bigInteger('latest_modified_topic_id')
                ->nullable()
                ->after('topic_id')
                ->comment('Latest modified topic ID');

            $table->bigInteger('latest_modified_task_id')
                ->nullable()
                ->after('task_id')
                ->comment('Latest modified task ID');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_task_files', function (Blueprint $table) {
            // Remove the correct bigint columns
            $table->dropColumn('latest_modified_topic_id');
            $table->dropColumn('latest_modified_task_id');
        });

        Schema::table('magic_super_agent_task_files', function (Blueprint $table) {
            // Restore the incorrect timestamp columns (for rollback)
            $table->timestamp('latest_modified_topic_id')
                ->nullable()
                ->after('topic_id')
                ->comment('最新版本topic_id');

            $table->timestamp('latest_modified_task_id')
                ->nullable()
                ->after('task_id')
                ->comment('最新版本task_id');
        });
    }
};
