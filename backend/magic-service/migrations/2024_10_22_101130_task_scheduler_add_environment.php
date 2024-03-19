<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

use function Hyperf\Config\config;

class TaskSchedulerAddEnvironment extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table(config('task_scheduler.table_names.task_scheduler', 'task_scheduler'), function (Blueprint $table) {
            $table->string('environment', 64)->default('')->comment('环境');

            $table->index(['environment', 'external_id']);
        });

        Schema::table(config('task_scheduler.table_names.task_scheduler_log', 'task_scheduler_log'), function (Blueprint $table) {
            $table->string('environment', 64)->default('')->comment('环境');

            $table->index(['environment', 'external_id']);
        });

        Schema::table(config('task_scheduler.table_names.task_scheduler_crontab', 'task_scheduler_crontab'), function (Blueprint $table) {
            $table->string('environment', 64)->default('')->comment('环境');

            $table->index(['environment', 'external_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
}
