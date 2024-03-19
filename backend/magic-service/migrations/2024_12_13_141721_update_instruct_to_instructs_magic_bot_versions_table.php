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
        Schema::table('magic_bot_versions', function (Blueprint $table) {
            // 先将原有的 instruct 字段重命名为 instructs
            $table->renameColumn('instruct', 'instructs');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_bot_versions', function (Blueprint $table) {
            // 回滚操作：将 instructs 改回 instruct
            $table->renameColumn('instructs', 'instruct');
        });
    }
};
