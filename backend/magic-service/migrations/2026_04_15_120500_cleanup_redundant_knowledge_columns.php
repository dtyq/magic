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
            $this->dropIndexIfExists('knowledge_base_documents', 'idx_kb_documents_source_file', $table);
            $this->dropIndexIfExists('knowledge_base_documents', 'idx_kb_documents_kb_project', $table);
            $this->dropIndexIfExists('knowledge_base_documents', 'idx_kb_documents_project_file', $table);
        });

        Schema::table('knowledge_base_documents', function (Blueprint $table) {
            $dropColumns = [];

            if (Schema::hasColumn('knowledge_base_documents', 'source_file_id')) {
                $dropColumns[] = 'source_file_id';
            }
            if (Schema::hasColumn('knowledge_base_documents', 'project_id')) {
                $dropColumns[] = 'project_id';
            }
            if (Schema::hasColumn('knowledge_base_documents', 'project_file_id')) {
                $dropColumns[] = 'project_file_id';
            }

            if ($dropColumns !== []) {
                $table->dropColumn($dropColumns);
            }
        });

        Schema::table('magic_flow_knowledge', function (Blueprint $table) {
            if (Schema::hasColumn('magic_flow_knowledge', 'is_draft')) {
                $table->dropColumn('is_draft');
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
