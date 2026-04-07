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
        if (Schema::hasTable('magic_super_magic_agents') && Schema::hasColumn('magic_super_magic_agents', 'description')) {
            Db::statement(
                "ALTER TABLE `magic_super_magic_agents` MODIFY COLUMN `description` TEXT NOT NULL COMMENT 'Agent 描述'"
            );
        }

        if (Schema::hasTable('magic_super_magic_agent_versions') && Schema::hasColumn('magic_super_magic_agent_versions', 'description')) {
            Db::statement(
                "ALTER TABLE `magic_super_magic_agent_versions` MODIFY COLUMN `description` TEXT NOT NULL COMMENT 'Agent 描述'"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
