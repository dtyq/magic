<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * 为分享访问记录表添加组织代码字段.
 */
return new class extends Migration {
    /**
     * 运行迁移.
     */
    public function up(): void
    {
        Schema::table('magic_resource_share_access_logs', function (Blueprint $table) {
            // 检查字段是否已存在，避免重复添加
            if (! Schema::hasColumn('magic_resource_share_access_logs', 'organization_code')) {
                $table->string('organization_code', 64)
                    ->nullable()
                    ->comment('访问者的组织代码（团队成员有值，匿名用户为NULL）')
                    ->after('user_id');

                // 添加索引：用于按组织代码统计访问情况
                $table->index(['share_id', 'organization_code'], 'idx_share_organization_code');
            }
        });
    }

    /**
     * 回滚迁移.
     */
    public function down(): void
    {
        Schema::table('magic_resource_share_access_logs', function (Blueprint $table) {
            if (Schema::hasColumn('magic_resource_share_access_logs', 'organization_code')) {
                // 删除索引（如果存在）
                try {
                    $table->dropIndex('idx_share_organization_code');
                } catch (Exception $e) {
                    // 索引可能不存在，忽略错误
                }

                // 删除字段
                $table->dropColumn('organization_code');
            }
        });
    }
};
