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
        Schema::table('magic_modes', function (Blueprint $table) {
            $table->json('placeholder_i18n')->nullable()->comment('模式占位符国际化')->after('name_i18n');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_modes', function (Blueprint $table) {
            $table->dropColumn('placeholder_i18n');
        });
    }
};
