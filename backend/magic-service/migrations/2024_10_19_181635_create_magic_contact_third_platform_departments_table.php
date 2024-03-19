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
        if (Schema::hasTable('magic_contact_third_platform_departments')) {
            return;
        }
        Schema::create('magic_contact_third_platform_departments', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('magic_department_id', 64)->comment('麦吉部门id');
            $table->string('magic_organization_code', 64)->comment('麦吉组织编码');
            $table->string('third_leader_user_id', 64)->comment('部门主管的用户 ID')->nullable()->default('');
            $table->string('third_department_id', 64)->comment('第三方部门id');
            $table->string('third_parent_department_id', 64)->comment('第三方父部门的部门 ID')->nullable();
            $table->string('third_name', 64)->comment('第三方部门名称');
            $table->text('third_i18n_name')->comment('第三方国际化部门名称');
            $table->string('third_platform_type')->comment('第三方平台类型 dingTalk/lark/weCom/teamShare');
            $table->text('third_platform_departments_extra')->comment('额外信息.第三方部门状态,json格式,目前支持 is_deleted:是否删除');
            $table->comment('用户服务的部门与第三方平台用户记录表.用于与第三方平台实时数据同步,激活记录等');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['third_platform_type', 'third_department_id', 'magic_organization_code'], 'org_platform_department_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_contact_third_platform_departments');
    }
};
