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
        if (Schema::hasTable('magic_super_agent_workspaces')) {
            return;
        }
        Schema::create('magic_super_agent_workspaces', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('user_id', 64)->comment('用户id');
            $table->string('user_organization_code', 64)->comment('用户组织编码');
            $table->string('chat_conversation_id', 64)->comment('聊天会话id');
            $table->string('name', 64)->comment('工作区名称');
            $table->tinyInteger('is_archived')->default(0)->comment('是否归档 0否 1是');
            $table->string('created_uid', 64)->default('')->comment('创建者用户ID');
            $table->string('updated_uid', 64)->default('')->comment('更新者用户ID');
            $table->datetimes();
            $table->softDeletes();
            $table->unsignedBigInteger('current_topic_id')->nullable()->comment('当前话题ID');
            $table->tinyInteger('status')->default(0)->comment('状态 0:正常 1:不显示 2：删除');
            $table->index(['user_id'], 'idx_user_id');
            $table->index(['chat_conversation_id'], 'idx_chat_conversation_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_general_agent_workspaces');
    }
};
