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
        Schema::table('knowledge_base_documents', function (Blueprint $table) {
            // 删除旧的唯一索引
            $table->dropUnique('unique_code_version');

            // 添加新的唯一索引
            $table->unique(['knowledge_base_code', 'code', 'version'], 'unique_knowledge_base_code_code_version');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('knowledge_base_documents', function (Blueprint $table) {
            // 删除新的唯一索引
            $table->dropUnique('unique_code_version');

            // 恢复旧的唯一索引
            $table->unique(['code', 'version'], 'unique_code_version');
        });
    }
};
