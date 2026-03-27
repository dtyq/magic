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
        if (! Schema::hasTable('magic_skills')) {
            return;
        }

        Schema::table('magic_skills', static function (Blueprint $table) {
            if (! Schema::hasColumn('magic_skills', 'source_i18n')) {
                $table->json('source_i18n')
                    ->nullable()
                    ->after('description_i18n')
                    ->comment('Source information in i18n format');
            }
        });
    }

    public function down(): void
    {
    }
};
