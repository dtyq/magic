<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

use function Hyperf\Config\config;

class TaskSchedulerCrontabAddFilterId extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table(config('task_scheduler.table_names.task_scheduler_crontab', 'task_scheduler_crontab'), function (Blueprint $table) {
            $table->string('filter_id', 255)->default('')->comment('过滤数据的id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
}
