<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class CreateMagicChatFriendTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('magic_chat_friends')) {
            return;
        }
        Schema::create('magic_chat_friends', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('user_id', 64)->comment('用户id');
            // 用户所属组织
            $table->string('user_organization_code', 64)->comment('用户组织编码')->default('');
            $table->string('friend_id', 64)->comment('好友id');
            // 好友所属组织
            $table->string('friend_organization_code', 64)->comment('好友的组织编码')->default('');
            // 好友类型
            $table->tinyInteger('friend_type')->comment('好友类型，0:ai 1:人类')->default(0);
            $table->string('remarks', 256)->comment('备注');
            $table->string('extra', 1024)->comment('附加属性');
            $table->tinyInteger('status')->comment('状态，1：申请，2：同意 3：拒绝 4：忽略');
            $table->unique(['user_id', 'friend_id'], 'uk_user_id_friend_id');
            $table->timestamps();
            $table->softDeletes();
            $table->comment('好友表');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_chat_friends');
    }
}
