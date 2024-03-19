<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddIsEnabledToMagicResourceSharesTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            // 添加 is_enabled 字段，默认为启用状态
            $table->tinyInteger('is_enabled')
                ->default(1)
                ->comment('是否启用（0=禁用，1=启用）')
                ->after('target_ids');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            // 删除字段
            $table->dropColumn('is_enabled');
        });
    }
}
