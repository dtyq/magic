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
            if (! Schema::hasIndex('magic_flow_knowledge', 'idx_magic_flow_knowledge_org_deleted_id')) {
                $table->index(['organization_code', 'deleted_at', 'id'], 'idx_magic_flow_knowledge_org_deleted_id');
            }
            if (! Schema::hasIndex('magic_flow_knowledge', 'idx_magic_flow_knowledge_org_business_deleted_id')) {
                $table->index(['organization_code', 'business_id', 'deleted_at', 'id'], 'idx_magic_flow_knowledge_org_business_deleted_id');
            }
        });
    }

    public function down(): void
    {
        // no-op
    }
};
