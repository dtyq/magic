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
        Schema::table('magic_contact_users', static function (Blueprint $table) {
            $table->dropIndex('unq_magic_id_organization_code');
            $table->unique(['magic_id', 'organization_code'], 'unq_magic_id_organization_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_contact_users', function (Blueprint $table) {
        });
    }
};
