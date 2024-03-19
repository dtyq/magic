<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    private const INDEX_NAME = 'idx_magic_tokens_expired_at';

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('magic_tokens')) {
            return;
        }

        Schema::table('magic_tokens', static function (Blueprint $table) {
            if (! Schema::hasIndex('magic_tokens', self::INDEX_NAME)) {
                $table->index('expired_at', self::INDEX_NAME);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('magic_tokens')) {
            return;
        }

        Schema::table('magic_tokens', static function (Blueprint $table) {
            if (Schema::hasIndex('magic_tokens', self::INDEX_NAME)) {
                $table->dropIndex(self::INDEX_NAME);
            }
        });
    }
};
