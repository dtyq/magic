<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

use function Hyperf\Config\config;

class CreateTaskScheduler extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create(config('task_scheduler.table_names.task_scheduler', 'task_scheduler'), function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('external_id', 64)->comment('业务 id')->index();
            $table->string('name', 64)->comment('名称');
            $table->dateTimeTz('expect_time')->comment('预期执行时间');
            $table->dateTimeTz('actual_time')->nullable()->comment('实际执行时间');
            $table->tinyInteger('type')->default(2)->comment('类型');
            $table->integer('cost_time')->default(0)->comment('耗时 毫秒');
            $table->integer('retry_times')->default(0)->comment('剩余重试次数');
            $table->tinyInteger('status')->default(0)->comment('状态');
            $table->json('callback_method')->comment('回调方法');
            $table->json('callback_params')->comment('回调参数');
            $table->string('remark', 255)->default('')->comment('备注');
            $table->string('creator', 64)->default('')->comment('创建人');
            $table->dateTimeTz('created_at')->comment('创建时间');
            $table->index(['status', 'expect_time']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists(config('task_scheduler.table_names.task_scheduler', 'task_scheduler'));
    }
}
