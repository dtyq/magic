<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('knowledge_base_documents', function (Blueprint $table) {
            if (! Schema::hasColumn('knowledge_base_documents', 'source_binding_id')) {
                $table->unsignedBigInteger('source_binding_id')->default(0)->comment('来源绑定ID')->after('knowledge_base_code');
            }
            if (! Schema::hasColumn('knowledge_base_documents', 'source_item_id')) {
                $table->unsignedBigInteger('source_item_id')->default(0)->comment('来源项ID')->after('source_binding_id');
            }
            if (! Schema::hasColumn('knowledge_base_documents', 'auto_added')) {
                $table->boolean('auto_added')->default(false)->comment('是否自动加入')->after('source_item_id');
            }
            if (! Schema::hasIndex('knowledge_base_documents', 'idx_kb_documents_source_binding_deleted_id')) {
                $table->index(['source_binding_id', 'deleted_at', 'id'], 'idx_kb_documents_source_binding_deleted_id');
            }
            if (! Schema::hasIndex('knowledge_base_documents', 'idx_kb_documents_source_item_deleted_id')) {
                $table->index(['source_item_id', 'deleted_at', 'id'], 'idx_kb_documents_source_item_deleted_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('knowledge_base_documents', function (Blueprint $table) {
            if (Schema::hasIndex('knowledge_base_documents', 'idx_kb_documents_source_binding_deleted_id')) {
                $table->dropIndex('idx_kb_documents_source_binding_deleted_id');
            }
            if (Schema::hasIndex('knowledge_base_documents', 'idx_kb_documents_source_item_deleted_id')) {
                $table->dropIndex('idx_kb_documents_source_item_deleted_id');
            }
            $dropColumns = [];
            if (Schema::hasColumn('knowledge_base_documents', 'source_binding_id')) {
                $dropColumns[] = 'source_binding_id';
            }
            if (Schema::hasColumn('knowledge_base_documents', 'source_item_id')) {
                $dropColumns[] = 'source_item_id';
            }
            if (Schema::hasColumn('knowledge_base_documents', 'auto_added')) {
                $dropColumns[] = 'auto_added';
            }
            if ($dropColumns !== []) {
                $table->dropColumn($dropColumns);
            }
        });
    }
};
