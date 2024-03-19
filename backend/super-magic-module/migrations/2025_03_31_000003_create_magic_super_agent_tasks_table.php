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
        if (Schema::hasTable('magic_super_agent_task')) {
            return;
        }
        Schema::create('magic_super_agent_task', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('user_id', 64)->comment('用户id。');
            $table->unsignedBigInteger('workspace_id')->comment('工作区id。');
            $table->unsignedBigInteger('topic_id')->comment('话题id。');
            $table->string('task_id', 64)->comment('任务id。沙箱服务返回的');
            $table->string('sandbox_id', 64)->comment('沙箱id。');
            $table->string('prompt', 5000)->comment('用户的问题。');
            $table->string('attachments', 500)->comment('用户上传的附件信息。用 json格式存储');
            $table->string('task_status', 64)->comment('任务状态 waiting, running，finished，error');
            $table->string('work_dir', 255)->comment('工作区目录');
            $table->timestamps();
            $table->softDeletes();

            // 创建索引
            $table->index(['user_id', 'workspace_id'], 'idx_user_workspace');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_general_agent_task');
    }
};
