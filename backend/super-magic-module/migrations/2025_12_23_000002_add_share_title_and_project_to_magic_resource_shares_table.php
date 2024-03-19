<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * 为资源分享表添加是否分享整个项目字段.
 */
return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            // 添加是否分享整个项目字段
            if (! Schema::hasColumn('magic_resource_shares', 'share_project')) {
                $table->boolean('share_project')
                    ->default(false)
                    ->comment('是否分享整个项目')
                    ->after('share_range');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            if (Schema::hasColumn('magic_resource_shares', 'share_project')) {
                $table->dropColumn('share_project');
            }
        });
    }
};
