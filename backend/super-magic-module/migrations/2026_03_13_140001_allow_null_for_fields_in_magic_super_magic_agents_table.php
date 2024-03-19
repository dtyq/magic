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
        if (! Schema::hasTable('magic_super_magic_agents')) {
            return;
        }

        Schema::table('magic_super_magic_agents', function (Blueprint $table) {
            // 将 name_i18n 字段改为允许 NULL
            if (Schema::hasColumn('magic_super_magic_agents', 'name_i18n')) {
                $table->json('name_i18n')->nullable()->change()->comment('Agent 名称（多语言），格式：{"zh":"市场分析师","en":"Marketing Analyst"}');
            }
            // 将 source_type 字段改为允许 NULL
            if (Schema::hasColumn('magic_super_magic_agents', 'source_type')) {
                $table->string('source_type', 32)->nullable()->default('LOCAL_CREATE')->change()->comment('关联来源类型：LOCAL_CREATE=本地创建, STORE=商店添加');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('magic_super_magic_agents')) {
            return;
        }

        Schema::table('magic_super_magic_agents', function (Blueprint $table) {
            // 将 name_i18n 字段改回 NOT NULL
            if (Schema::hasColumn('magic_super_magic_agents', 'name_i18n')) {
                $table->json('name_i18n')->nullable(false)->change()->comment('Agent 名称（多语言），格式：{"zh":"市场分析师","en":"Marketing Analyst"}');
            }
            // 将 source_type 字段改回 NOT NULL
            if (Schema::hasColumn('magic_super_magic_agents', 'source_type')) {
                $table->string('source_type', 32)->nullable(false)->default('LOCAL_CREATE')->change()->comment('关联来源类型：LOCAL_CREATE=本地创建, STORE=商店添加');
            }
        });
    }
};
