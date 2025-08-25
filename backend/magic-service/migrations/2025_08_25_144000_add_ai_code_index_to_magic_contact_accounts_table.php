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
        Schema::table('magic_contact_accounts', function (Blueprint $table) {
            // 为 ai_code 字段添加索引
            $table->index('ai_code', 'idx_ai_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_contact_accounts', function (Blueprint $table) {
            // 删除 ai_code 索引
            $table->dropIndex('idx_ai_code');
        });
    }
};
