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
            if (! Schema::hasColumn('magic_skill_versions', 'skill_file_key')) {
                // Store the published SKILL.md file key separately from the package archive key.
                $table->string('skill_file_key', 512)
                    ->nullable()
                    ->after('file_key')
                    ->comment('Skill.md file key snapshot');
            }
        });
    }

    public function down(): void
    {
    }
};
