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
        if (Schema::hasTable('magic_contact_users')) {
            return;
        }
        Schema::create('magic_contact_users', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('magic_id', 64)->comment('账号id,冗余字段')->default('');
            // 组织编码
            $table->string('organization_code', 64)->comment('组织编码')->default('');
            // user_id
            $table->string('user_id', 64)->comment('用户id,组织下唯一.此字段还会记录一份到user_id_relation')->default(0);
            // user_type
            $table->tinyInteger('user_type')->comment('用户类型,0:ai,1:人类')->default(0);
            $table->string('description', 1024)->comment('描述(可用于ai的自我介绍)');
            $table->integer('like_num')->comment('点赞数')->default(0);
            $table->string('label', 256)->comment('自我标签，多个用逗号分隔')->default('');
            $table->tinyInteger('status')->comment('用户在该组织的状态,0:冻结,1:已激活,2:已离职,3:已退出')->default(0);
            $table->string('nickname', 64)->comment('昵称')->default('');
            $table->text('i18n_name')->comment('国际化用户名称');
            $table->string('avatar_url', 128)->comment('用户头像链接')->default('');
            $table->string('extra', 1024)->comment('附加属性')->default('');
            $table->string('user_manual', 64)->comment('用户说明书(云文档)')->default('');
            // 索引设置
            $table->unique(['user_id'], 'unq_user_organization_id');
            $table->unique(['magic_id', 'organization_code'], 'unq_magic_id_organization_code');
            $table->index(['organization_code'], 'idx_organization_code');
            $table->timestamps();
            $table->softDeletes();
            $table->comment('组织的用户表');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_contact_users');
    }
};
