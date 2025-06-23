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
        Schema::create('magic_user_settings', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code', 32)->default('')->comment('组织编码');
            $table->string('user_id', 64)->comment('用户ID');
            $table->string('key', 80)->comment('设置键');
            $table->json('value')->comment('设置值');
            $table->string('creator', 100)->comment('创建者');
            $table->timestamp('created_at')->nullable()->comment('创建时间');
            $table->string('modifier', 100)->comment('修改者');
            $table->timestamp('updated_at')->nullable()->comment('更新时间');

            $table->index(['organization_code', 'user_id'], 'idx_org_user');
            $table->unique(['organization_code', 'user_id', 'key'], 'uk_org_user_key');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_user_settings');
    }
};
