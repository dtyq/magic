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
        if (Schema::hasTable('magic_role_users')) {
            return;
        }
        Schema::create('magic_role_users', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('role_id')->comment('角色ID');
            $table->string('user_id', 64)->comment('用户ID，对应magic_contact_users.user_id');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->string('assigned_by', 64)->nullable()->comment('分配者用户ID');
            $table->timestamp('assigned_at')->nullable()->comment('分配时间');
            $table->timestamps();
            $table->softDeletes();

            // 索引
            $table->index(['organization_code', 'role_id', 'user_id'], 'idx_organization_code_role_user_id');
            $table->index(['organization_code', 'user_id'], 'idx_organization_code_user_id');

            $table->comment('RBAC角色用户关联表');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_role_users');
    }
};
