<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * Remove unnecessary indexes from magic_resource_shares table.
 */
return new class extends Migration {
    /**
     * Run the migration.
     */
    public function up(): void
    {
        if (! Schema::hasTable('magic_resource_shares')) {
            return;
        }

        Schema::table('magic_resource_shares', function (Blueprint $table) {
            // Check and drop indexes if they exist
            if (Schema::hasIndex('magic_resource_shares', 'magic_resource_shares_created_at_index')) {
                $table->dropIndex('magic_resource_shares_created_at_index');
            }

            if (Schema::hasIndex('magic_resource_shares', 'magic_resource_shares_created_uid_organization_code_index')) {
                $table->dropIndex('magic_resource_shares_created_uid_organization_code_index');
            }

            if (Schema::hasIndex('magic_resource_shares', 'magic_resource_shares_expire_at_index')) {
                $table->dropIndex('magic_resource_shares_expire_at_index');
            }

            if (Schema::hasIndex('magic_resource_shares', 'magic_resource_shares_share_code_unique')) {
                $table->dropUnique('magic_resource_shares_share_code_unique');
            }
        });
    }

    /**
     * Reverse the migration.
     */
    public function down(): void
    {
        if (! Schema::hasTable('magic_resource_shares')) {
            return;
        }

        Schema::table('magic_resource_shares', function (Blueprint $table) {
            // Recreate the indexes
            $table->index('created_at', 'magic_resource_shares_created_at_index');
            $table->index(['created_uid', 'organization_code'], 'magic_resource_shares_created_uid_organization_code_index');
            $table->index('expire_at', 'magic_resource_shares_expire_at_index');
            $table->unique('share_code', 'magic_resource_shares_share_code_unique');
        });
    }
};
