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
        Schema::table('magic_api_organization_configs', function (Blueprint $table) {
            $table->dropIndex('idx_organization');
            $table->dropIndex('magic_api_organization_configs_app_code_organization_code_index');

            $table->unique(['app_code', 'organization_code'], 'idx_app_org');
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
