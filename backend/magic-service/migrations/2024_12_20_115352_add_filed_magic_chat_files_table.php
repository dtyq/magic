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
        Schema::table('magic_chat_files', function (Blueprint $table) {
            $table->string('external_url', 1024)
                ->default('')
                ->comment('外链地址');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_chat_files', function (Blueprint $table) {
            $table->dropColumn('external_url');
        });
    }
};
