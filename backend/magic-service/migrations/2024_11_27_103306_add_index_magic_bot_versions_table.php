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
        Schema::table('magic_bot_versions', function (Blueprint $table) {
            $table->index(['root_id']);
            $table->index(['organization_code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_bot_versions', function (Blueprint $table) {
            $table->dropIndex(['root_id']);
            $table->dropIndex(['organization_code']);
        });
    }
};
