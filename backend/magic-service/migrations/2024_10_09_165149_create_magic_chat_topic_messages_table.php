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
        if (Schema::hasTable('magic_chat_topic_messages')) {
            return;
        }
        // 话题的相关消息表
        // 话题包含的 message_id 列表. 不在seq表加话题id字段,避免seq承载的功能太多,需要加太多索引
        Schema::create('magic_chat_topic_messages', static function (Blueprint $table) {
            // 消息id
            $table->bigIncrements('seq_id')->comment('消息的序列id.不在seq表加话题id字段,避免seq承载的功能太多,需要加太多索引');
            // 会话id. 冗余字段
            $table->string('conversation_id', 64)->comment('消息所属会话id');
            // 组织编码. 冗余字段
            $table->string('organization_code', 64)->comment('组织编码');
            // 话题id
            $table->unsignedBigInteger('topic_id')->comment('消息所属话题id');
            # 索引
            $table->index(['conversation_id', 'topic_id'], 'idx_conversation_topic_id');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_chat_topic_messages');
    }
};
