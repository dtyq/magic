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
        if (Schema::hasTable('magic_contact_third_platform_department_users')) {
            return;
        }
        Schema::create('magic_contact_third_platform_department_users', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('magic_department_id', 64)->comment('部门id');
            $table->string('magic_organization_code', 32)->comment('麦吉的组织编码');
            $table->string('third_department_id', 64)->comment('第三方部门id');
            $table->string('third_union_id')->comment('第三方平台用户的union_id');
            $table->string('third_platform_type', 32)->comment('第三方平台类型 dingTalk/lark/weCom/teamShare');
            $table->tinyInteger('third_is_leader')->comment('是否是部门领导 0-否 1-是')->default(0);
            $table->string('third_job_title', 64)->comment('在此部门的职位')->default('');
            $table->string('third_leader_user_id', 64)->comment('在此部门的直属领导的 user_id')->default('');
            $table->string('third_city', 64)->comment('工作城市')->default('');
            $table->string('third_country', 32)->comment('国家或地区 Code 缩写')->default('CN');
            $table->string('third_join_time', 64)->comment('入职时间。秒级时间戳格式，表示从 1970 年 1 月 1 日开始所经过的秒数。');
            $table->string('third_employee_no', 32)->comment('工号')->default('');
            $table->tinyInteger('third_employee_type')->comment('员工类型。1：正式员工2：实习生3：外包4：劳务 5：顾问')->default(1);
            $table->text('third_custom_attrs')->comment('自定义字段。');
            $table->text('third_department_path')->comment('部门路径。');
            $table->text('third_platform_department_users_extra')->comment('额外信息');
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
        Schema::dropIfExists('magic_contact_third_platform_department_users');
    }
};
