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
        if (! Schema::hasTable('magic_skill_market') || ! Schema::hasColumn('magic_skill_market', 'description_i18n')) {
            return;
        }

        Db::statement(
            "ALTER TABLE `magic_skill_market` MODIFY COLUMN `description_i18n` LONGTEXT NULL COMMENT '多语言展示描述，格式同 name_i18n'"
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
