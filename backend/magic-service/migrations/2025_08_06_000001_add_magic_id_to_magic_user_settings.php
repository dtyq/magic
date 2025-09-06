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
        // Add magic_id column and index if they do not exist
        if (! Schema::hasColumn('magic_user_settings', 'magic_id')) {
            Schema::table('magic_user_settings', function (Blueprint $table) {
                $table->string('magic_id', 64)->nullable()->comment('账号 MagicId')->after('organization_code');
                $table->index(['magic_id', 'key'], 'idx_magic_user_settings_magic_id_key');
            });
        }

        // Make organization_code、user_id nullable
        Schema::table('magic_user_settings', function (Blueprint $table) {
            $table->string('organization_code', 32)->nullable()->default(null)->change();
            $table->string('user_id', 64)->nullable()->change();
        });
    }

    public function down(): void
    {
        // Revert organization_code、user_id back to NOT NULL
        Schema::table('magic_user_settings', function (Blueprint $table) {
            $table->string('organization_code', 32)->default('')->nullable(false)->change();
            $table->string('user_id', 64)->nullable(false)->change();
        });

        // Remove magic_id column and its index if they exist
        if (Schema::hasColumn('magic_user_settings', 'magic_id')) {
            Schema::table('magic_user_settings', function (Blueprint $table) {
                $table->dropIndex('idx_magic_user_settings_magic_id_key');
                $table->dropColumn('magic_id');
            });
        }
    }
};
