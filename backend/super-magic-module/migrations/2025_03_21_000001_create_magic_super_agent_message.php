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
        if (Schema::hasTable('magic_super_agent_message')) {
            return;
        }
        Schema::create('magic_super_agent_message', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('sender_type', 32)->comment('发送者类型(user/ai)');
            $table->string('sender_uid', 64)->comment('发送者ID');
            $table->string('receiver_uid', 64)->comment('接收者ID');
            $table->string('message_id', 64)->unique()->comment('消息ID');
            $table->string('type', 32)->comment('消息类型');
            $table->string('task_id', 64)->comment('任务ID');
            $table->bigInteger('topic_id')->nullable()->comment('话题ID');
            $table->string('status', 32)->nullable()->comment('任务状态');
            $table->text('content')->comment('消息内容');
            $table->json('steps')->nullable()->comment('步骤信息');
            $table->json('tool')->nullable()->comment('工具调用信息');
            $table->string('event', 64)->comment('事件类型');
            $table->integer('send_timestamp')->comment('发送时间戳');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['task_id', 'type'], 'idx_task_type');
            $table->index(['sender_uid', 'created_at'], 'idx_sender_created');
            $table->index(['receiver_uid', 'created_at'], 'idx_receiver_created');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_general_agent_message');
    }
};
