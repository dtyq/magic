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
        if (Schema::hasTable('magic_chat_sequences')) {
            return;
        }
        Schema::create('magic_chat_sequences', static function (Blueprint $table) {
            // 根据上面的建表语句，得出以下代码
            $table->bigIncrements('id')->comment('主键id,没啥用');
            $table->string('organization_code', 64)->comment('序列号所属的组织编码.')->default('');
            $table->tinyInteger('object_type')->comment('对象类型,0:ai,1:用户；2：应用;3:文档;4:多维表格');
            $table->string('object_id', 64)->comment('对象id. 如果是用户时,表示magic_id');
            $table->string('seq_id', 64)->comment('消息序列号 id，每个账号的所有消息必须逐渐增大');
            $table->string('seq_type', 32)->comment('消息大类型:控制消息,聊天消息。');
            $table->text('content')->comment('序列号详情. 一些不可见的控制消息,只在seq表存在详情. 以及写时复制一份message表content到seq表用.');
            $table->string('magic_message_id', 64)->comment('服务端生成的唯一消息id,用于消息撤回/编辑');
            $table->string('message_id', 64)->comment('序列号关联的用户消息id,实现已读回执,消息撤回/编辑等')->default(0);
            // 引用的消息id
            $table->string('refer_message_id', 64)->comment('引用的消息id,实现已读回执,消息撤回/编辑等');
            // sender_message_id
            $table->string('sender_message_id', 64)->comment('发送方的消息id,用于消息撤回/编辑');
            // 会话id
            $table->string('conversation_id', 64)->comment('消息所属会话id,冗余字段');
            $table->tinyInteger('status')->default(0)->comment('消息状态,0:unread, 1:seen, 2:read, 3:revoked');
            // 消息接收人列表
            $table->text('receive_list')->comment('消息接收人列表,全量记录未读/已读/已查看用户列表');
            $table->text('extra')->comment('附加字段，记录一些扩展属性。 比如话题id。');
            // app_message_id
            $table->string('app_message_id', 64)->default('')->comment('冗余字段,客户端生成的消息id,用于防客户端重复');
            # 以下是索引设置
            // magic_message_id 索引
            $table->index(['magic_message_id'], 'idx_magic_message_id');
            // 因为经常需要按 seq_id 排序，所以增加联合索引
            // 以下索引创建移动到单独的迁移文件中
            $table->timestamps();
            $table->softDeletes();
            $table->comment('账号收件箱的序列号表,每个账号的所有消息必须单调递增');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_chat_sequences');
    }
};
