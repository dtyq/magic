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
        if (Schema::hasTable('magic_contact_department_users')) {
            return;
        }
        Schema::create('magic_contact_department_users', static function (Blueprint $table) {
            $table->bigIncrements('id');
            // magic_id
            $table->string('magic_id', 64)->comment('magic_contact_account 表的 magic_id')->default('');
            // magic_user_id
            $table->string('user_id', 64)->comment('magic_contact_user 表的 user_id')->default('');
            $table->string('department_id', 64)->comment('部门id');
            $table->tinyInteger('is_leader')->comment('是否是部门领导 0-否 1-是')->default(0);
            $table->string('job_title', 64)->comment('在此部门的职位')->default('');
            $table->string('leader_user_id', 64)->comment('在此部门的直属领导的 user_id')->nullable()->default('');
            $table->string('organization_code', 32)->comment('麦吉的组织编码');
            $table->string('city', 64)->comment('工作城市')->default('');
            $table->string('country', 32)->comment('国家或地区 Code 缩写')->default('');
            $table->string('join_time', 32)->comment('入职时间。秒级时间戳格式，表示从 1970 年 1 月 1 日开始所经过的秒数。')->default('');
            $table->string('employee_no', 32)->comment('工号')->default('');
            $table->tinyInteger('employee_type')->comment('员工类型。1：正式员工2：实习生3：外包4：劳务 5：顾问');
            $table->string('orders', 256)->comment('用户排序信息。用于标记通讯录下组织架构的人员顺序，人员可能存在多个部门中，且有不同的排序')->nullable()->default('');
            $table->text('custom_attrs')->comment('自定义字段。');
            $table->tinyInteger('is_frozen')->comment('是否为暂停状态的用户。')->default(0);
            $table->comment('麦吉部门下的用户信息表');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['organization_code', 'magic_id'], 'org_magic_id');
            $table->index(['department_id'], 'index_department_id');
            $table->index(['user_id'], 'index_user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_contact_department_users');
    }
};
