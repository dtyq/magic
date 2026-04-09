<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('magic_model_access_role_users')) {
            return;
        }

        Schema::create('magic_model_access_role_users', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->unsignedBigInteger('role_id')->comment('角色ID');
            $table->string('user_id', 64)->comment('员工用户ID');
            $table->string('assigned_by', 64)->nullable()->comment('分配人用户ID');
            $table->timestamp('assigned_at')->nullable()->comment('分配时间');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['organization_code', 'role_id'], 'idx_org_role_id');
            $table->index(['organization_code', 'user_id'], 'idx_org_user_id');
            $table->comment('模型访问角色用户绑定表');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_model_access_role_users');
    }
};
