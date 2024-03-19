<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * 为资源分享表添加分享范围字段.
 */
return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            // 检查字段是否已存在，避免重复添加
            if (! Schema::hasColumn('magic_resource_shares', 'share_range')) {
                $table->string('share_range', 64)
                    ->nullable()
                    ->comment('分享范围（all=同组织，designated=部门/成员）')
                    ->after('is_enabled');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            if (Schema::hasColumn('magic_resource_shares', 'share_range')) {
                $table->dropColumn('share_range');
            }
        });
    }
};
