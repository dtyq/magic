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
        Schema::table('magic_super_agent_audio_project', function (Blueprint $table) {
            $table->string('audio_source', 32)->default('recorded')->comment('Audio source type: recorded-recording, imported-imported')->after('source');
            $table->unsignedBigInteger('audio_file_id')->nullable()->comment('Current audio file ID')->after('audio_source');
        });

        echo 'Added audio_source and audio_file_id columns to magic_super_agent_audio_project table' . PHP_EOL;
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
