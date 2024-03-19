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
        // 修改表结构，添加新字段
        Schema::table('magic_flow_knowledge', function (Blueprint $table) {
            $table->unsignedBigInteger('word_count')->default(0)->comment('字数统计');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::rename('magic_flow_knowledge', 'magic_flow_knowledge');
        Schema::table('magic_flow_knowledge', function (Blueprint $table) {
            $table->dropColumn('word_count');
        });
    }
};
