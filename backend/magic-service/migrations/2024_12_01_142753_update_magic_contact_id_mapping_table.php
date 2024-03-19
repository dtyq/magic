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
        // 删除 magic_contact_id_mapping 表名
        Schema::dropIfExists('magic_contact_id_mapping');
        // 删除 magic_contact_third_platform_department_users/magic_contact_third_platform_departments/magic_contact_third_platform_users 表
        Schema::dropIfExists('magic_contact_third_platform_department_users');
        Schema::dropIfExists('magic_contact_third_platform_departments');
        Schema::dropIfExists('magic_contact_third_platform_users');

        if (Schema::hasTable('magic_contact_third_platform_id_mapping')) {
            return;
        }
        Schema::create('magic_contact_third_platform_id_mapping', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('origin_id', 128)->comment('源id');
            $table->string('new_id', 64)->comment('新id');
            // 映射类型：用户 id、部门 id、空间 id，组织编码
            $table->string('mapping_type', 32)->comment('映射类型（user、department、space、organization）');
            // 第三方平台类型：企业微信、钉钉、飞书
            $table->string('third_platform_type', 32)->comment('第三方平台类型（wechat_work、dingtalk、lark）');
            // magic 体系的组织编码
            $table->string('magic_organization_code', 32)->comment('magic 体系的组织编码');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['new_id', 'mapping_type'], 'new_id_mapping_type');
            $table->unique(['magic_organization_code', 'third_platform_type', 'mapping_type', 'origin_id'], 'unique_origin_id_mapping_type');
            $table->comment('部门、用户、空间编码等的映射关系记录');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
