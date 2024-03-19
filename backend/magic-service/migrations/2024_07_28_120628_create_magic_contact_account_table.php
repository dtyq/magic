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
        if (Schema::hasTable('magic_contact_accounts')) {
            return;
        }
        Schema::create('magic_contact_accounts', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('magic_id', 64)->comment('账号id,跨租户(组织)唯一. 为了避免与user_id(组织内唯一)的概念混淆,因此起名了magic_id')->default('');
            // 账号类型
            $table->tinyInteger('type')->comment('账号类型,0:ai,1:人类')->default(0);
            // ai_code
            $table->string('ai_code', 64)->comment('ai编码')->default('');
            // 账号状态
            $table->tinyInteger('status')->comment('账号状态,0:正常,1:禁用')->default(0);
            // 国际冠码
            $table->string('country_code', 16)->comment('国际冠码')->default('');
            // 手机号
            $table->string('phone', 64)->comment('手机号')->default('');
            // 邮箱
            $table->string('email', 64)->comment('邮箱')->default('');
            // 真名
            $table->string('real_name', 64)->comment('真名')->default('');
            // 性别
            $table->tinyInteger('gender')->comment('性别，0:未知；1:男；2:女')->default(0);
            // 附加属性
            $table->string('extra', 1024)->comment('附加属性.')->default('');

            // 索引设置
            $table->index(['status', 'type'], 'idx_status_type');
            $table->unique(['magic_id'], 'unq_magic_id');
            $table->unique(['country_code', 'phone'], 'unq_country_code_phone');
            $table->timestamps();
            $table->softDeletes();
            $table->comment('用户账号表,记录用户跨组织唯一的信息,比如的手机号/真名/性别/用户类型等');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_contact_accounts');
    }
};
