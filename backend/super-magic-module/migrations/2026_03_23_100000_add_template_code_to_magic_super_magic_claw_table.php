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
        if (! Schema::hasTable('magic_super_magic_claw')) {
            return;
        }

        if (Schema::hasColumn('magic_super_magic_claw', 'template_code')) {
            return;
        }

        Schema::table('magic_super_magic_claw', function (Blueprint $table) {
            $table->string('template_code', 64)->default('openclaw')->comment('Template code: openclaw or magicshock')->after('icon');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('magic_super_magic_claw')) {
            return;
        }

        Schema::table('magic_super_magic_claw', function (Blueprint $table) {
            $table->dropColumn('template_code');
        });
    }
};
