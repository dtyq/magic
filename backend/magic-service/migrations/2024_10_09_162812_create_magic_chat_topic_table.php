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
        if (Schema::hasTable('magic_chat_topics')) {
            return;
        }
        // 话题表
        Schema::create('magic_chat_topics', static function (Blueprint $table) {
            $table->bigIncrements('id');
            // 话题 id
            $table->string('topic_id', 64)->comment('话题 id. 不同会话窗口中,话题id一致');
            // 话题名称
            $table->string('name', 50)->comment('话题名称');
            // 话题描述
            $table->text('description')->comment('话题描述');
            // 所属会话ID
            $table->bigInteger('conversation_id')->comment('所属会话ID');
            // 组织编码
            $table->string('organization_code', 64)->comment('组织编码');
            // 话题来源
            $table->string('source_id', 64)->default('')->comment('话题的来源。 比如甲创建了一个话题，乙的话题id就来自于甲。需要同步更新。');
            # 索引
            $table->index(['conversation_id'], 'idx_conversation_id');
            $table->index(['topic_id'], 'idx_topic_id');
            $table->timestamps();
            $table->softDeletes();
            $table->comment('话题表');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_chat_topics');
    }
};
