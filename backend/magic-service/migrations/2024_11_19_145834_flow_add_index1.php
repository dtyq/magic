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
        Schema::table('magic_flow_knowledge', function (Blueprint $table) {
            $table->index(['organization_code', 'type', 'updated_at'], 'idx_combined');
        });

        Schema::table('magic_flow_knowledge_fragment', function (Blueprint $table) {
            $table->index(['sync_status', 'sync_times'], 'idx_sync');
        });

        Schema::table('magic_flows', function (Blueprint $table) {
            $table->index(['organization_code', 'type'], 'idx_organization_type');
        });

        Schema::table('magic_operation_permissions', function (Blueprint $table) {
            $table->index(['organization_code', 'resource_type', 'target_id'], 'idx_organization_resource_type_target_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('', function (Blueprint $table) {
        });
    }
};
