<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * 为资源分享表添加过期天数字段.
 */
return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            // 添加过期天数字段
            if (! Schema::hasColumn('magic_resource_shares', 'expire_days')) {
                $table->unsignedSmallInteger('expire_days')
                    ->nullable()
                    ->comment('过期天数（1-365天，null表示永久有效）')
                    ->after('expire_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            if (Schema::hasColumn('magic_resource_shares', 'expire_days')) {
                $table->dropColumn('expire_days');
            }
        });
    }
};
