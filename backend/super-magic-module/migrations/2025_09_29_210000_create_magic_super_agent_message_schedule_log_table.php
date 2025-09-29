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
        Schema::create('magic_super_agent_message_schedule_log', function (Blueprint $table) {
            $table->bigInteger('id')->primary()->comment('主键ID (雪花ID)');
            $table->bigInteger('message_schedule_id')->comment('关联的定时任务ID');
            $table->bigInteger('workspace_id')->unsigned()->comment('工作区ID');
            $table->bigInteger('project_id')->unsigned()->comment('项目ID');
            $table->bigInteger('topic_id')->unsigned()->comment('话题ID');
            $table->string('task_name', 255)->comment('任务名称');
            $table->tinyInteger('status')->comment('执行状态: 1-成功, 2-失败, 3-运行中');
            $table->dateTime('executed_at')->comment('执行时间');
            $table->string('error_message', 500)->nullable()->comment('错误信息');
            $table->timestamps();

            // 添加索引
            $table->index(['message_schedule_id'], 'idx_message_schedule_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
