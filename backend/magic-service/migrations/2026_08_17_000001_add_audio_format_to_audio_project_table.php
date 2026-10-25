<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('magic_super_agent_audio_project')) {
            return;
        }

        if (! Schema::hasColumn('magic_super_agent_audio_project', 'audio_format')) {
            Schema::table('magic_super_agent_audio_project', static function (Blueprint $table): void {
                $table->string('audio_format', 16)
                    ->nullable()
                    ->after('audio_source')
                    ->comment('Audio format; recorded tasks use wav/opus, imported files keep their extension');
            });
        }

        // Existing recorded tasks predate OGG support and are WAV tasks.
        Db::table('magic_super_agent_audio_project')
            ->where('audio_source', 'recorded')
            ->whereNull('audio_format')
            ->update(['audio_format' => 'wav']);
    }

    public function down(): void
    {
    }
};
