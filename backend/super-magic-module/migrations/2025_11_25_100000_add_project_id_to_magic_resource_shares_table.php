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
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            // 检查字段是否已存在，避免重复添加
            if (! Schema::hasColumn('magic_resource_shares', 'project_id')) {
                $table->unsignedBigInteger('project_id')->nullable()->after('resource_id')->comment('项目ID');

                // 添加索引以提高查询性能
                $table->index('project_id', 'idx_project_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            if (Schema::hasColumn('magic_resource_shares', 'project_id')) {
                // 先删除索引
                $table->dropIndex('idx_project_id');
                // 再删除字段
                $table->dropColumn('project_id');
            }
        });
    }
};
