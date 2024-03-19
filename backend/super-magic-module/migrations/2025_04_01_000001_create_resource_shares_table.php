<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * 创建资源分享表.
 */
return new class extends Migration {
    /**
     * 运行迁移.
     */
    public function up(): void
    {
        if (Schema::hasTable('magic_resource_shares')) {
            return;
        }
        Schema::create('magic_resource_shares', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('resource_id', 64)->comment('资源ID');
            $table->unsignedTinyInteger('resource_type')->comment('资源类型');
            $table->string('resource_name', 255)->comment('资源名称');
            $table->string('share_code', 64)->unique()->comment('分享代码');
            $table->unsignedTinyInteger('share_type')->comment('分享类型');
            $table->string('password', 64)->nullable()->comment('访问密码');
            $table->timestamp('expire_at')->nullable()->comment('过期时间');
            $table->unsignedInteger('view_count')->default(0)->comment('查看次数');
            $table->string('created_uid', 64)->default('')->comment('创建者用户ID');
            $table->string('updated_uid', 64)->default('')->comment('更新者用户ID');
            $table->string('organization_code', 64)->comment('组织代码');
            $table->json('target_ids')->nullable()->comment('目标IDs');
            $table->timestamps();
            $table->softDeletes();

            // 添加索引
            $table->index('resource_id');
            $table->index(['resource_type', 'resource_id']);
            $table->index(['created_uid', 'organization_code']);
            $table->index('created_at');
            $table->index('expire_at');
        });
    }

    /**
     * 回滚迁移.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_resource_shares');
    }
};
