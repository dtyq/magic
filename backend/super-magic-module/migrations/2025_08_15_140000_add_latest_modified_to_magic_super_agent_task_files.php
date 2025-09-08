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
            $table->bigInteger('latest_modified_topic_id')
                ->nullable()
                ->after('topic_id')
                ->comment('最新版本topic_id');

            $table->bigInteger('latest_modified_task_id')
                ->nullable()
                ->after('task_id')
                ->comment('最新版本task_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_task_files', function (Blueprint $table) {
        });
    }
};
