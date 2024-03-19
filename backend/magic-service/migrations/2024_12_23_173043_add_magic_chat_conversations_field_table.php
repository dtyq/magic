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
        Schema::table('magic_chat_conversations', function (Blueprint $table) {
            if (Schema::hasColumn('magic_chat_conversations', 'translate_config')) {
                return;
            }
            $table->json('translate_config')->nullable()->comment('翻译配置项');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
        });
    }
};
