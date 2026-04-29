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
        Schema::table('magic_flow_knowledge_fragment', function (Blueprint $table) {
            $this->dropIndexIfExists('magic_flow_knowledge_fragment', 'idx_fragment_knowledge_document', $table);
            $this->dropIndexIfExists('magic_flow_knowledge_fragment', 'idx_fragment_point_id', $table);
            $this->dropIndexIfExists('magic_flow_knowledge_fragment', 'idx_fragment_point_deleted_id', $table);
            $this->dropIndexIfExists('magic_flow_knowledge_fragment', 'idx_fragment_deleted', $table);
            $this->dropIndexIfExists('magic_flow_knowledge_fragment', 'idx_fragment_sync', $table);
            $this->dropIndexIfExists('magic_flow_knowledge_fragment', 'idx_sync', $table);
            $this->dropIndexIfExists('magic_flow_knowledge_fragment', 'knowledge_base_fragments_parent_fragment_id_index', $table);
            $this->dropIndexIfExists('magic_flow_knowledge_fragment', 'idx_knowledge_document_version', $table);

            if (Schema::hasColumn('magic_flow_knowledge_fragment', 'point_id')
                && ! Schema::hasIndex('magic_flow_knowledge_fragment', 'idx_fragment_point_id_id')) {
                $table->index(['point_id', 'id'], 'idx_fragment_point_id_id');
            }
            if (Schema::hasColumn('magic_flow_knowledge_fragment', 'knowledge_code')
                && Schema::hasColumn('magic_flow_knowledge_fragment', 'document_code')
                && Schema::hasColumn('magic_flow_knowledge_fragment', 'deleted_at')
                && Schema::hasColumn('magic_flow_knowledge_fragment', 'id')
                && ! Schema::hasIndex('magic_flow_knowledge_fragment', 'idx_knowledge_document_deleted_id')) {
                $table->index(['knowledge_code', 'document_code', 'deleted_at', 'id'], 'idx_knowledge_document_deleted_id');
            }
            if (Schema::hasColumn('magic_flow_knowledge_fragment', 'knowledge_code')
                && Schema::hasColumn('magic_flow_knowledge_fragment', 'business_id')
                && ! Schema::hasIndex('magic_flow_knowledge_fragment', 'idx_knowledge_code_business_id')) {
                $table->index(['knowledge_code', 'business_id'], 'idx_knowledge_code_business_id');
            }
            if (Schema::hasColumn('magic_flow_knowledge_fragment', 'knowledge_code')
                && Schema::hasColumn('magic_flow_knowledge_fragment', 'updated_at')
                && ! Schema::hasIndex('magic_flow_knowledge_fragment', 'magic_flow_knowledge_fragment_knowledge_code_updated_at_index')) {
                $table->index(['knowledge_code', 'updated_at'], 'magic_flow_knowledge_fragment_knowledge_code_updated_at_index');
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
