<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * 创建分享访问记录表.
 */
return new class extends Migration {
    /**
     * 运行迁移.
     */
    public function up(): void
    {
        if (Schema::hasTable('magic_resource_share_access_logs')) {
            return;
        }
        Schema::create('magic_resource_share_access_logs', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('主键ID');
            $table->unsignedBigInteger('share_id')->comment('分享ID（关联 magic_resource_shares.id）');
            $table->timestamp('access_time')->comment('访问时间（精确到秒）');
            $table->string('user_type', 20)->comment('用户类型：guest=游客，team_member=团队成员，anonymous=匿名用户');
            $table->string('user_id', 64)->nullable()->comment('用户ID（团队成员有值，匿名用户为NULL）');
            $table->string('user_name', 255)->nullable()->comment('用户名（用于展示）');
            $table->string('ip_address', 45)->nullable()->comment('IP地址（用于匿名用户去重统计）');
            $table->timestamp('created_at')->nullable()->comment('创建时间');

            // 核心索引：优化查询性能
            $table->index('share_id', 'idx_share_id');                                    // 查询某个分享的所有访问记录
            $table->index(['share_id', 'access_time'], 'idx_share_access_time');          // 按时间范围查询和统计今日访问
            $table->index(['share_id', 'user_type'], 'idx_share_user_type');              // 统计团队成员/匿名用户数
            $table->index('access_time', 'idx_access_time');                               // 时间范围过滤
        });
    }

    /**
     * 回滚迁移.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_resource_share_access_logs');
    }
};
