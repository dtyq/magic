<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class CreateAsyncEventRecords extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('async_event_records', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('event', 255)->comment('事件');
            $table->string('listener', 255)->comment('监听器');
            $table->tinyInteger('status')->default(0)->comment('事件执行状态  0:待执行； 1:执行中； 2:执行完成； 3:超出重试次数；');
            $table->tinyInteger('retry_times')->default(0)->comment('重试次数');
            $table->longText('args')->comment('事件参数 目前是 serialize($event)');
            $table->timestamps();
            $table->index(['status', 'updated_at']);

            $table->comment('异步事件记录表');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('async_event_records');
    }
}
