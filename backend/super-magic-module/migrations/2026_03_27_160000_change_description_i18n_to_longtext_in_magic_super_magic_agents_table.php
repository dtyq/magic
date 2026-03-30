<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('magic_super_magic_agents') || ! Schema::hasColumn('magic_super_magic_agents', 'description_i18n')) {
            return;
        }

        Db::statement(
            "ALTER TABLE `magic_super_magic_agents` MODIFY COLUMN `description_i18n` LONGTEXT NULL COMMENT '核心职责与适用场景描述（多语言）'"
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
