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
     * Change unique index from (organization_code, user_id, key) to (user_id, key)
     * to fix index prefix truncation issue causing duplicate key errors.
     */
    public function up(): void
    {
        Schema::table('magic_user_settings', function (Blueprint $table) {
            // Drop old unique index
            $table->dropUnique('uk_org_user_key');

            // Create new unique index with user_id + key only
            // user_id is already organization-scoped, so organization_code is redundant
            $table->unique(['user_id', 'key'], 'uk_user_key');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_user_settings', function (Blueprint $table) {
            // Drop new unique index
            $table->dropUnique('uk_user_key');

            // Restore old unique index
            $table->unique(['organization_code', 'user_id', 'key'], 'uk_org_user_key');
        });
    }
};
