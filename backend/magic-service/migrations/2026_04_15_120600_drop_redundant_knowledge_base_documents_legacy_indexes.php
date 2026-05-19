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
            $this->dropIndexIfExists('knowledge_base_documents', 'knowledge_base_documents_knowledge_base_code_index', $table);
            $this->dropIndexIfExists('knowledge_base_documents', 'index_third_platform_type_id', $table);
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
