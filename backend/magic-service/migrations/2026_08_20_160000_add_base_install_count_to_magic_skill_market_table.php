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
        if (! Schema::hasTable('magic_skill_market') || Schema::hasColumn('magic_skill_market', 'base_install_count')) {
            return;
        }

        Schema::table('magic_skill_market', static function (Blueprint $table) {
            $table->integer('base_install_count')
                ->default(0)
                ->after('install_count')
                ->comment('');
        });
    }

    public function down(): void
    {
    }
};
