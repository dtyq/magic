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
        Schema::table('service_provider_models', function (Blueprint $table) {
            // 按 model_id,status,organization_code 组合索引
            if (! Schema::hasIndex('service_provider_models', 'idx_model_id_status_organization_code')) {
                $table->index(['model_id', 'status', 'organization_code'], 'idx_model_id_status_organization_code');
            }

            // 按 organization_code,status,model_version 组合索引
            if (! Schema::hasIndex('service_provider_models', 'idx_organization_code_status_model_version')) {
                $table->index(['organization_code', 'status', 'model_version'], 'idx_organization_code_status_model_version');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
