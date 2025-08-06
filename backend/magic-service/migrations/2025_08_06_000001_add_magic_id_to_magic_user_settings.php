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
        if (! Schema::hasColumn('magic_user_settings', 'magic_id')) {
            Schema::table('magic_user_settings', function (Blueprint $table) {
                $table->string('magic_id', 64)->nullable()->comment('账号 MagicId')->after('organization_code');
                $table->index(['magic_id'], 'idx_magic_user_settings_magic_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('magic_user_settings', 'magic_id')) {
            Schema::table('magic_user_settings', function (Blueprint $table) {
                $table->dropIndex(['magic_id']);
                $table->dropColumn('magic_id');
            });
        }
    }
};
