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
        Schema::create('magic_flow_wait_messages', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code', 32)->comment('组织编码');
            $table->string('conversation_id', 120)->comment('会话ID');
            $table->string('origin_conversation_id', 80)->comment('原始会话ID');
            $table->string('message_id', 80)->comment('消息ID');
            $table->string('wait_node_id', 80)->comment('等待节点ID');
            $table->string('flow_code', 80)->comment('流程编码');
            $table->string('flow_version', 80)->comment('流程版本');
            $table->integer('timeout')->default(0)->comment('超时时间戳');
            $table->boolean('handled')->default(false)->comment('是否已处理');
            $table->json('persistent_data')->nullable()->comment('持久化数据');
            $table->string('created_uid', 80)->comment('创建人');
            $table->dateTime('created_at')->comment('创建时间');
            $table->string('updated_uid', 80)->comment('修改人');
            $table->dateTime('updated_at')->comment('修改时间');

            $table->index(['organization_code', 'conversation_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_flow_wait_messages');
    }
};
