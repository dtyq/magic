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
        if (Schema::hasTable('magic_roles')) {
            return;
        }
        Schema::create('magic_roles', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name', 255)->comment('角色名称');
            $table->json('permission_key')->nullable()->comment('角色权限列表');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->tinyInteger('is_display')->default(1)->comment('是否展示: 0=否, 1=是');
            $table->json('permission_tag')->nullable()->comment('权限标签，用于前端展示分类');
            $table->tinyInteger('status')->default(1)->comment('状态: 0=禁用, 1=启用');
            $table->string('created_uid', 64)->nullable()->comment('创建者用户ID');
            $table->string('updated_uid', 64)->nullable()->comment('更新者用户ID');
            $table->timestamps();
            $table->softDeletes();

            // 索引
            $table->index(['organization_code'], 'idx_organization_code');

            $table->comment('RBAC角色表');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_roles');
    }
};
