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
        Schema::create('magic_super_agent_project_operation_logs', function (Blueprint $table) {
            $table->bigInteger('id')->primary()->comment('主键ID');
            $table->bigInteger('project_id')->index()->comment('项目ID');
            $table->string('user_id', 36)->index()->comment('用户ID');
            $table->string('organization_code', 64)->index()->comment('组织编码');
            $table->string('operation_action', 64)->comment('操作动作');
            $table->string('resource_type', 32)->comment('资源类型');
            $table->string('resource_id', 128)->comment('资源ID');
            $table->string('resource_name', 512)->comment('资源名称');
            $table->json('operation_details')->nullable()->comment('操作详情');
            $table->string('operation_status', 32)->default('success')->comment('操作状态');
            $table->string('ip_address', 45)->nullable()->comment('IP地址');
            $table->timestamp('created_at')->nullable()->comment('创建时间');
            $table->timestamp('updated_at')->nullable()->comment('更新时间');

            // 核心索引：项目为中心的查询
            $table->index(['project_id', 'created_at'], 'idx_project_created');
            $table->index(['project_id', 'user_id', 'created_at'], 'idx_project_user_created');
            $table->index(['project_id', 'operation_action', 'created_at'], 'idx_project_action_created');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_super_agent_project_operation_logs');
    }
};
