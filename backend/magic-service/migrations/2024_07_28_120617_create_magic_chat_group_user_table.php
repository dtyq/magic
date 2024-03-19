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
        if (Schema::hasTable('magic_chat_group_users')) {
            return;
        }
        Schema::create('magic_chat_group_users', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('group_id', 64)->comment('群id');
            $table->string('user_id', 64)->comment('用户id');
            $table->tinyInteger('user_role')->default(1)->comment('用户角色,1:普通用户；2：管理员 3:群主');
            $table->tinyInteger('user_type')->default(1)->comment('用户类型,0:ai；1：人类. 冗余字段');
            $table->tinyInteger('status')->default(1)->comment('状态,1:正常；2：禁言');
            $table->string('organization_code', 64)->comment('进群时,用户所在组织编码');
            $table->unique(['group_id', 'user_id', 'organization_code'], 'uniq_idx_group_user');
            $table->softDeletes();
            $table->timestamps();
            $table->comment('群成员表');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_chat_group_users');
    }
};
