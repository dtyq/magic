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
        if (Schema::hasTable('magic_super_agent_message_queue')) {
            return;
        }
        Schema::create('magic_super_agent_message_queue', function (Blueprint $table) {
            $table->bigInteger('id')->primary()->comment('队列ID (雪花ID)');
            $table->string('user_id', 128)->comment('用户ID');
            $table->string('organization_code', 64)->comment('组织代码');
            $table->bigInteger('project_id')->unsigned()->comment('项目ID');
            $table->bigInteger('topic_id')->unsigned()->comment('话题ID');
            $table->text('message_content')->comment('消息内容');
            $table->string('message_type', 64)->comment('消息类型');
            $table->tinyInteger('status')->default(0)->comment('状态: 0-待处理, 1-已完成, 2-执行失败, 3-进行中');
            $table->timestamp('execute_time')->nullable()->comment('执行时间');
            $table->timestamp('except_execute_time')->nullable()->comment('期望执行时间');
            $table->string('err_message', 500)->nullable()->comment('执行错误消息');
            $table->timestamp('deleted_at')->nullable()->comment('删除时间');
            $table->timestamps();

            // 索引优化
            $table->index(['user_id', 'project_id', 'topic_id'], 'idx_user_project_topic');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
