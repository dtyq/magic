<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

use function Hyperf\Config\config;

class CreateTaskSchedulerCrontab extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create(config('task_scheduler.table_names.task_scheduler_crontab', 'task_scheduler_crontab'), function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('external_id', 64)->comment('业务 id')->index();
            $table->string('name', 64)->comment('名称');
            $table->string('crontab', 64)->comment('crontab表达式');
            $table->dateTime('last_gen_time')->nullable()->comment('最后生成时间');
            $table->boolean('enabled')->default(true)->comment('是否启用');
            $table->integer('retry_times')->default(0)->comment('总重试次数');
            $table->json('callback_method')->comment('回调方法');
            $table->json('callback_params')->comment('回调参数');
            $table->string('remark', 255)->default('')->comment('备注');
            $table->dateTime('deadline')->nullable()->comment('结束时间');
            $table->string('creator', 64)->default('')->comment('创建人');
            $table->dateTime('created_at')->comment('创建时间');

            $table->index(['last_gen_time']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists(config('task_scheduler.table_names.task_scheduler_crontab', 'task_scheduler_crontab'));
    }
}
