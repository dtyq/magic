<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

class AddPasswordEnabledToMagicResourceSharesTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            // 添加 is_password_enabled 字段，控制密码保护是否启用
            $table->tinyInteger('is_password_enabled')
                ->default(0)
                ->comment('是否启用密码保护（0=关闭，1=开启）')
                ->after('password');
        });

        // 为现有有密码的记录启用密码保护
        Db::table('magic_resource_shares')
            ->whereNotNull('password')
            ->where('password', '!=', '')
            ->update(['is_password_enabled' => 1]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            // 删除字段
            $table->dropColumn('is_password_enabled');
        });
    }
}
