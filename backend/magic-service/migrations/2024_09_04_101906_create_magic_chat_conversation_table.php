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
        // 判断表是否存在
        if (Schema::hasTable('magic_chat_conversations')) {
            return;
        }
        Schema::create('magic_chat_conversations', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('user_id', 64)->comment('用户id。此会话窗口属于该用户。');
            $table->string('user_organization_code', 64)->comment('用户组织编码');
            // 收件人组织编码
            $table->tinyInteger('receive_type')->comment('会话类型。1：私聊，2：群聊，3：系统消息，4：云文档，5：多维表格 6：话题 7：应用消息');
            $table->string('receive_id', '64')->comment('会话另一方的id。不同的conversation type，id含义不同。');
            $table->string('receive_organization_code', 64)->comment('收件人组织编码');
            // 是否免打扰
            $table->tinyInteger('is_not_disturb')->default(0)->comment('是否免打扰 0否 1是');
            // 是否置顶
            $table->tinyInteger('is_top')->default(0)->comment('是否置顶 0否 1是');
            // 是否标记
            $table->tinyInteger('is_mark')->default(0)->comment('是否标记 0否 1是');
            // status
            $table->tinyInteger('status')->default(0)->comment('会话状态。0:正常 1:不显示 2：删除');
            // 当前话题 id
            $table->string('current_topic_id', 64)->comment('当前话题id')->nullable()->default('');
            // 自定义字段
            $table->text('extra')->comment('自定义字段')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['user_id', 'receive_id', 'receive_type', 'user_organization_code', 'receive_organization_code'], 'unq_user_conversation');
            $table->comment('用户的会话列表。会话可能是私聊、群聊、系统消息、一个云文档或者多维表格等。');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_chat_conversations');
    }
};
