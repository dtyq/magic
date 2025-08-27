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
        Schema::table('magic_chat_sequences', function (Blueprint $table) {
            // 检查deleted_at字段是否存在，如果不存在则添加软删除字段
            if (! Schema::hasColumn('magic_chat_sequences', 'deleted_at')) {
                $table->softDeletes()->comment('软删除时间');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_chat_sequences', function (Blueprint $table) {
            // 回滚时删除deleted_at字段（仅在字段存在时）
            if (Schema::hasColumn('magic_chat_sequences', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });
    }
};
