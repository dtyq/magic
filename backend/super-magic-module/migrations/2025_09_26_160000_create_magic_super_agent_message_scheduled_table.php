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
            $table->tinyInteger('completed')->default(0)->comment('是否完成: 0-未完成, 1-已完成');
            $table->tinyInteger('enabled')->default(1)->comment('是否启用: 0-禁用, 1-启用');
            $table->dateTime('deadline')->nullable()->comment('结束时间');
            $table->string('remark', 500)->default('')->comment('备注');
            $table->json('time_config')->comment('配置信息');
            $table->bigInteger('task_scheduler_crontab_id')->nullable()->comment('任务调度器定时任务ID');
            $table->string('created_uid', 36)->default('')->comment('Creator user ID');
            $table->string('updated_uid', 36)->default('')->comment('Updater user ID');
            $table->timestamp('deleted_at')->nullable()->comment('删除时间');
            $table->timestamps();

            // 添加索引
            // 1. 主要查询索引（覆盖基础查询 + 排序优化）
            // 用途：user_id + organization_code + deleted_at + updated_at 排序
            $table->index(['user_id', 'organization_code', 'deleted_at', 'updated_at'], 'idx_user_org_deleted_updated');

            // 2. 工作区查询索引
            // 用途：workspace_id + user_id + organization_code + deleted_at 筛选
            $table->index(['workspace_id', 'user_id', 'organization_code', 'deleted_at'], 'idx_workspace_user_org_deleted');

            // 3. 项目查询索引
            // 用途：project_id + user_id + organization_code + deleted_at 筛选
            $table->index(['project_id', 'user_id', 'organization_code', 'deleted_at'], 'idx_project_user_org_deleted');

            // 4. 状态查询索引
            // 用途：enabled + completed + deleted_at 状态筛选
            $table->index(['enabled', 'completed', 'deleted_at'], 'idx_enabled_completed_deleted');

            // 5. 截止时间查询索引
            // 用途：deadline + enabled + deleted_at 定时任务管理
            $table->index(['deadline', 'enabled', 'deleted_at'], 'idx_deadline_enabled_deleted');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
}
