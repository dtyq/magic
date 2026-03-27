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
        if (! Schema::hasTable('magic_skill_versions')) {
            return;
        }

        Schema::table('magic_skill_versions', static function (Blueprint $table) {
            if (! Schema::hasColumn('magic_skill_versions', 'source_i18n')) {
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
