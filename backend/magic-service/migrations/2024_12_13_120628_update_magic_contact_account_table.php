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
        Schema::table('magic_contact_accounts', static function (Blueprint $table) {
            // magic_environment_id
            $table->bigInteger('magic_environment_id')->comment('magic_environments 表的 id')->default(0);
            $table->dropIndex('unq_country_code_phone');
            $table->index(['country_code', 'phone', 'magic_environment_id'], 'idx_country_code_phone');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
