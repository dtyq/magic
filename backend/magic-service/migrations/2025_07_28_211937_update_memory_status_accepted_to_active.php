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
        // 将现有的 'accepted' 状态更新为 'active' 状态
        Db::table('magic_long_term_memories')
            ->where('status', 'accepted')
            ->update(['status' => 'active']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // 回滚：将 'active' 状态改回 'accepted' 状态
        Db::table('magic_long_term_memories')
            ->where('status', 'active')
            ->update(['status' => 'accepted']);
    }
};
