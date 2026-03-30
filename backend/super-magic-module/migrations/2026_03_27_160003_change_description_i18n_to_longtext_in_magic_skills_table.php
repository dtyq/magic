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
        if (! Schema::hasTable('magic_skills') || ! Schema::hasColumn('magic_skills', 'description_i18n')) {
            return;
        }

        Db::statement(
            "ALTER TABLE `magic_skills` MODIFY COLUMN `description_i18n` LONGTEXT NULL COMMENT '多语言展示描述，格式同 name_i18n；desc 字段从此 JSON 的 en 值提取'"
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
