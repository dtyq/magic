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
        if (! Schema::hasTable('magic_resource_access_logs')) {
            return;
        }

        Schema::table('magic_resource_access_logs', static function (Blueprint $table): void {
            if (! Schema::hasIndex('magic_resource_access_logs', 'idx_org_user_resource_operation_code_created')) {
                $table->index(
                    ['organization_code', 'user_id', 'resource_type', 'operation', 'resource_code', 'created_at'],
                    'idx_org_user_resource_operation_code_created'
                );
            }
        });
    }

    public function down(): void
    {
    }
};
