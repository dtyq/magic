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
        if (Schema::hasTable('magic_organization_admins')) {
            return;
        }
        Schema::create('magic_organization_admins', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('user_id', 64)->comment('用户ID，对应magic_contact_users.user_id');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->string('magic_id', 64)->nullable()->comment('Magic ID');
            $table->string('grantor_user_id', 64)->nullable()->comment('授权者用户ID');
            $table->timestamp('granted_at')->nullable()->comment('授权时间');
            $table->tinyInteger('status')->default(1)->comment('状态: 0=禁用, 1=启用');
            $table->text('remarks')->nullable()->comment('备注');
            $table->timestamps();
            $table->softDeletes();

            // 索引
            $table->index(['organization_code', 'user_id'], 'idx_organization_code_user_id');
            $table->index(['magic_id'], 'idx_magic_id');

            $table->comment('组织管理员表');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_organization_admins');
    }
};
