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
            $this->dropIndexIfExists('knowledge_base_documents', 'idx_kb_documents_code', $table);
            $this->dropIndexIfExists('knowledge_base_documents', 'idx_kb_documents_deleted', $table);
            $this->dropIndexIfExists('knowledge_base_documents', 'idx_kb_documents_org_id', $table);
            $this->dropIndexIfExists('knowledge_base_documents', 'idx_kb_documents_kb_id', $table);
            $this->dropIndexIfExists('knowledge_base_documents', 'idx_kb_documents_source_binding_deleted_id', $table);
            $this->dropIndexIfExists('knowledge_base_documents', 'idx_kb_documents_source_item_deleted_id', $table);
            $this->dropIndexIfExists('knowledge_base_documents', 'idx_kb_documents_source_file', $table);
            $this->dropIndexIfExists('knowledge_base_documents', 'idx_kb_documents_kb_project', $table);
            $this->dropIndexIfExists('knowledge_base_documents', 'idx_kb_documents_project_file', $table);

            if (! Schema::hasIndex('knowledge_base_documents', 'idx_kb_documents_org_kb')) {
                $table->index(['organization_code', 'knowledge_base_code'], 'idx_kb_documents_org_kb');
            }
            if (! Schema::hasIndex('knowledge_base_documents', 'idx_kb_documents_code_id')) {
                $table->index(['code', 'id'], 'idx_kb_documents_code_id');
            }
            if (! Schema::hasIndex('knowledge_base_documents', 'idx_kb_documents_source_binding_id_id')) {
                $table->index(['source_binding_id', 'id'], 'idx_kb_documents_source_binding_id_id');
            }
            if (! Schema::hasIndex('knowledge_base_documents', 'idx_kb_documents_source_item_id_id')) {
                $table->index(['source_item_id', 'id'], 'idx_kb_documents_source_item_id_id');
            }
            if (! Schema::hasIndex('knowledge_base_documents', 'idx_kb_documents_kb_third_file')) {
                $table->index(['third_platform_type', 'third_file_id', 'knowledge_base_code'], 'idx_kb_documents_kb_third_file');
            }
            if (! Schema::hasIndex('knowledge_base_documents', 'idx_kb_documents_org_third_file')) {
                $table->index(['third_platform_type', 'third_file_id', 'organization_code'], 'idx_kb_documents_org_third_file');
            }
        });
    }

    public function down(): void
    {
        // no-op
    }

    private function dropIndexIfExists(string $tableName, string $indexName, Blueprint $table): void
    {
        if (Schema::hasIndex($tableName, $indexName)) {
            $table->dropIndex($indexName);
        }
    }
};
