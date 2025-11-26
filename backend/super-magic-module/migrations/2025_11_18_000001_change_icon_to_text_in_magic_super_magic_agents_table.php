<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 使用原生 SQL 修改字段类型，从 VARCHAR(100) 改为 TEXT
        Db::statement("ALTER TABLE `magic_super_magic_agents` MODIFY COLUMN `icon` TEXT NULL COMMENT 'Agent图标'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
