<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * 为资源分享表添加默认打开文件ID字段.
 */
return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            // 添加 default_open_file_id 字段，与 magic_super_agent_task_files 表的 file_id 字段类型一致
            $table->bigInteger('default_open_file_id')
                ->nullable()
                ->comment('默认打开的文件ID')
                ->after('extra');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            $table->dropColumn('default_open_file_id');
        });
    }
};
