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
            $this->dropIndexIfExists('magic_flow_knowledge_fragment', 'idx_sync', $table);
            $this->dropIndexIfExists('magic_flow_knowledge_fragment', 'knowledge_base_fragments_parent_fragment_id_index', $table);
            $this->dropIndexIfExists('magic_flow_knowledge_fragment', 'idx_knowledge_document_version', $table);
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
