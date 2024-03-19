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
        if (Schema::hasTable('magic_super_agent_topics')) {
            return;
        }
        Schema::create('magic_super_agent_topics', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('user_id', 64)->default('')->comment('用户ID');
            $table->unsignedBigInteger('workspace_id')->default(0)->comment('工作区ID');
            $table->string('chat_conversation_id', 64)->default('')->comment('chat的会话id');
            $table->string('chat_topic_id', 64)->default('')->comment('chat的话题id');
            $table->string('sandbox_id', 64)->default('')->comment('沙箱id');
            $table->string('current_task_id', 64)->default('')->comment('当前任务id');
            $table->string('current_task_status', 64)->default('')->comment('当前任务状态 waiting, running，finished，error');
            $table->string('topic_name', 64)->default('')->comment('话题名称');
            $table->string('work_dir', 255)->default('')->comment('工作区目录');
            $table->string('created_uid', 64)->default('')->comment('创建者用户ID');
            $table->string('updated_uid', 64)->default('')->comment('更新者用户ID');
            $table->datetimes();
            $table->softDeletes()->comment('删除时间');

            // 创建索引
            $table->index(['user_id', 'workspace_id'], 'idx_user_workspace');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_general_agent_topics');
    }
};
