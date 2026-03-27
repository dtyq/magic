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
        if (! Schema::hasTable('magic_super_magic_agent_versions') || ! Schema::hasColumn('magic_super_magic_agent_versions', 'description_i18n')) {
            return;
        }

        Db::statement(
            "ALTER TABLE `magic_super_magic_agent_versions` MODIFY COLUMN `description_i18n` LONGTEXT NULL COMMENT '核心职责与适用场景描述（多语言），格式：{\"zh\":\"...\",\"en\":\"...\"}'"
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
