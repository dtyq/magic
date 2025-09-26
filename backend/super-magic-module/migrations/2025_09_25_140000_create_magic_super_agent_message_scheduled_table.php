<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class CreateMagicSuperAgentMessageScheduledTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('magic_super_agent_message_scheduled', function (Blueprint $table) {
            $table->bigInteger('id')->primary()->comment('主键ID (雪花ID)');
            $table->string('user_id', 128)->comment('用户ID');
            $table->string('organization_code', 64)->comment('用户组织代码');
            $table->string('task_name', 255)->comment('定时任务名称');
            $table->string('message_type', 64)->comment('消息类型');
            $table->json('message_content')->comment('消息内容');
            $table->bigInteger('workspace_id')->unsigned()->comment('工作区ID');
            $table->bigInteger('project_id')->unsigned()->comment('项目ID');
            $table->bigInteger('topic_id')->unsigned()->comment('话题ID');
            $table->tinyInteger('status')->default(0)->comment('状态: 0-关闭, 1-开启');
            $table->json('time_config')->comment('配置信息');
            $table->bigInteger('task_scheduler_crontab_id')->nullable()->comment('任务调度器定时任务ID');
            $table->string('created_uid', 36)->default('')->comment('Creator user ID');
            $table->string('updated_uid', 36)->default('')->comment('Updater user ID');
            $table->timestamp('deleted_at')->nullable()->comment('删除时间');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
}
