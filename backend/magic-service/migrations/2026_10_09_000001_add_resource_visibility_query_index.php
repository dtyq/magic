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
        Schema::table('magic_resource_visibility', static function (Blueprint $table): void {
            $table->index(
                ['organization_code', 'resource_type', 'resource_code'],
                'idx_resource_visibility_resource_query'
            );
        });
    }

    public function down(): void
    {
        Schema::table('magic_resource_visibility', static function (Blueprint $table): void {
            $table->dropIndex('idx_resource_visibility_resource_query');
        });
    }
};
