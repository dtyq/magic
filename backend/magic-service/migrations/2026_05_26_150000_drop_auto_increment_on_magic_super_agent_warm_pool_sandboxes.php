<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

use Hyperf\Database\Migrations\Migration;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    private string $table = 'magic_super_agent_warm_pool_sandboxes';

    /**
     * Drop AUTO_INCREMENT on `id` so the repository can stamp snowflake ids
     * without colliding with MySQL's allocator. Keeps the column as
     * bigint unsigned primary key.
     */
    public function up(): void
    {
        Db::statement("ALTER TABLE `{$this->table}` MODIFY `id` BIGINT UNSIGNED NOT NULL");
    }

    public function down(): void
    {
        Db::statement("ALTER TABLE `{$this->table}` MODIFY `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT");
    }
};
