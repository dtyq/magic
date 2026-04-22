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
        Schema::table('magic_flow_knowledge', function (Blueprint $table) {
            $this->dropIndexIfExists('magic_flow_knowledge', 'idx_magic_flow_knowledge_org', $table);
            $this->dropIndexIfExists('magic_flow_knowledge', 'idx_magic_flow_knowledge_deleted', $table);
            $this->dropIndexIfExists('magic_flow_knowledge', 'idx_magic_flow_knowledge_org_deleted_id', $table);
            $this->dropIndexIfExists('magic_flow_knowledge', 'idx_magic_flow_knowledge_org_id', $table);
            $this->dropIndexIfExists('magic_flow_knowledge', 'idx_magic_flow_knowledge_org_business_deleted_id', $table);

            if (! Schema::hasIndex('magic_flow_knowledge', 'idx_magic_flow_knowledge_org_business_id')) {
                $table->index(['organization_code', 'business_id', 'id'], 'idx_magic_flow_knowledge_org_business_id');
            }
            if (! Schema::hasIndex('magic_flow_knowledge', 'idx_combined')) {
                $table->index(['organization_code', 'type', 'updated_at'], 'idx_combined');
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
