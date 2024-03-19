<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class CreateMagicChatMessageTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('magic_chat_messages')) {
            return;
        }
        Schema::create('magic_chat_messages', static function (Blueprint $table) {
            // 根据上面的建表语句，得出以下代码
            $table->bigIncrements('id');
            // 发件方所属组织
            $table->string('sender_id', 64)->comment('发件方的id');
            $table->tinyInteger('sender_type')->comment('发件方用户类型,1:用户(ai也被认为是用户)；2：应用;3:文档;4:多维表格');
            $table->string('sender_organization_code', 64)->comment('发件方组织编码,可能为空字符串')->default('');
            // 接收方所属组织
            $table->string('receive_id', 64)->comment('接收方id，可能是人类、ai或者应用/文档/多维表格等');
            $table->tinyInteger('receive_type')->comment('接收方类型,1:用户(ai也被认为是用户)；2：应用;3:文档;4:多维表格');
            $table->string('receive_organization_code', 64)->comment('接收方组织编码,可能为空字符串')->default('');
            // 消息的相关id
            $table->string('app_message_id', 64)->comment('客户端生成的消息id,用于防客户端重复');
            $table->string('magic_message_id', 64)->comment('服务端生成的唯一消息id,用于消息撤回/编辑');
            # ## 消息结构
            // 消息优先级,由于系统稳定性管理
            $table->tinyInteger('priority')->default(0)->comment('消息优先级,0~255,0最低,255最高');
            $table->string('message_type', 32)->comment('消息类型:文本/表情/文件/markdown等');
            $table->text('content')->comment('消息详情');
            $table->timestamp('send_time')->comment('消息发送时间');
            $table->index(['sender_id', 'sender_type', 'sender_organization_code'], 'idx_sender_id_type');
            $table->index(['receive_id', 'receive_type', 'receive_organization_code'], 'idx_receive_id_type');
            $table->unique(['magic_message_id'], 'unq_magic_message_id');
            $table->timestamps();
            $table->comment('消息详情表,记录一条消息的根本信息');
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_chat_messages');
    }
}
