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
        if (Schema::hasTable('magic_contact_third_platform_users')) {
            return;
        }
        Schema::create('magic_contact_third_platform_users', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('magic_id', 64)->nullable()->comment('magic_user_account 表的 magic_id');
            $table->string('magic_user_id', 64)->nullable()->comment('magic_user_organization 表的 user_id');
            $table->string('magic_organization_code', 32)->comment('麦吉用户体系下的组织code');
            $table->string('third_user_id', 128)->comment('第三方平台用户id');
            $table->string('third_union_id', 128)->comment('第三方平台用户 union_id');
            $table->string('third_platform_type', 32)->comment('第三方平台类型 dingTalk/lark/weCom/teamShare');
            $table->string('third_employee_no', 64)->nullable()->default('')->comment('工号');
            $table->string('third_real_name', 64)->comment('员工姓名');
            $table->string('third_nick_name', 64)->nullable()->default('')->comment('员工昵称');
            $table->text('third_avatar')->nullable()->comment('头像');
            $table->tinyInteger('third_gender')->default(0)->comment('员工性别 0-未知 1-男 2-女');
            $table->string('third_email', 128)->nullable()->default('')->comment('邮箱');
            $table->string('third_mobile', 64)->nullable()->default('')->comment('第三方平台员工手机号');
            $table->string('third_id_number', 64)->nullable()->default('')->comment('员工身份证');
            $table->text('third_platform_users_extra')->comment('额外信息');
            $table->index('magic_user_id', 'magic_user_id');
            $table->unique(['third_union_id', 'third_platform_type', 'magic_organization_code'], 'unique_third_id');
            $table->softDeletes();
            $table->timestamps();
            $table->comment('第三方平台同步过来的用户信息表. 不过天书有点特殊,可以直接把天书的用户当做麦吉的用户.');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_contact_third_platform_users');
    }
};
