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
        Schema::table('magic_flow_knowledge_fragment', function (Blueprint $table) {
            // 检查是否已存在字段，避免重复添加
            if (! Schema::hasColumn('magic_flow_knowledge_fragment', 'version')) {
                $table->unsignedInteger('version')->default(1)->comment('版本号');
            }
        });

        // 删除重复的索引
        Schema::table('magic_flow_knowledge_fragment', function (Blueprint $table) {
            if (Schema::hasIndex('magic_flow_knowledge_fragment', 'knowledge_base_fragments_document_code_index')) {
                $table->dropIndex('knowledge_base_fragments_document_code_index');
            }
        });

        // 添加新的复合索引
        Schema::table('magic_flow_knowledge_fragment', function (Blueprint $table) {
            // 检查是否已存在索引，避免重复添加
            if (! Schema::hasIndex('magic_flow_knowledge_fragment', 'idx_knowledge_document_version')) {
                $table->index(['knowledge_code', 'document_code', 'version'], 'idx_knowledge_document_version');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_flow_knowledge_fragment', function (Blueprint $table) {
            // 删除新添加的索引
            if (Schema::hasIndex('magic_flow_knowledge_fragment', 'idx_knowledge_document_version')) {
                $table->dropIndex('idx_knowledge_document_version');
            }

            // 恢复原有的索引
            if (! Schema::hasIndex('magic_flow_knowledge_fragment', 'knowledge_base_fragments_document_code_index')) {
                $table->index(['document_code'], 'knowledge_base_fragments_document_code_index');
            }

            // 检查是否已存在字段，避免重复删除
            if (Schema::hasColumn('magic_flow_knowledge_fragment', 'version')) {
                $table->dropColumn('version');
            }
        });
    }
};
