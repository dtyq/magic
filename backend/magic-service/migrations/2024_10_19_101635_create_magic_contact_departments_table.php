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
        if (Schema::hasTable('magic_contact_departments')) {
            return;
        }
        Schema::create('magic_contact_departments', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('department_id', 64)->comment('麦吉部门id');
            $table->string('parent_department_id', 64)->comment('父部门的部门 ID')->nullable();
            $table->string('name', 64)->comment('部门名称');
            $table->text('i18n_name')->comment('国际化部门名称');
            $table->string('order', 64)->comment('部门的排序，即部门在其同级部门的展示顺序。取值越小排序越靠前。')->nullable()->default('');
            $table->string('leader_user_id', 64)->comment('部门主管的用户 ID')->nullable()->default('');
            $table->string('organization_code', 64)->comment('麦吉组织编码');
            $table->text('status')->comment('部门状态,json格式,目前支持 is_deleted:是否删除');
            $table->string('document_id', 64)->comment('部门说明书（云文档id）');
            // level
            $table->integer('level')->comment('部门层级')->default(0);
            // path
            $table->text('path')->comment('部门路径')->nullable();
            // 部门直属用户人数
            $table->integer('employee_sum')->comment('部门直属用户人数')->default(0);
            $table->comment('用户服务的部门与第三方平台用户记录表.用于与第三方平台实时数据同步,激活记录等');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['organization_code', 'department_id'], 'org_department_id');
            $table->index(['organization_code', 'level'], 'org_department_level');
            $table->index(['organization_code', 'parent_department_id'], 'org_parent_department_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_contact_departments');
    }
};
