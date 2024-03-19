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
        Schema::table('magic_organizations_environment', function (Blueprint $table) {
            $table->dropIndex('idx_login_code');
            $table->dropIndex('idx_magic_organization_code');
            $table->unique('login_code', 'unq_login_code');
            $table->unique('magic_organization_code', 'unq_magic_organization_code');
            $table->unique(['environment_id', 'origin_organization_code'], 'unq_environment_organization_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
