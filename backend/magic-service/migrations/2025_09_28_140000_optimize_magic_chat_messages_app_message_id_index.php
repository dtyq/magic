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
        Schema::table('magic_chat_messages', function (Blueprint $table) {
            // Order: high selectivity -> filter condition -> optional filter
            $table->index(['app_message_id', 'message_type'], 'idx_app_message_covered');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
