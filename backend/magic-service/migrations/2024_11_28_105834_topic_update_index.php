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
        Schema::table('magic_chat_topics', function (Blueprint $table) {
            Schema::hasIndex('magic_chat_topics', 'idx_conversation_id') && $table->dropIndex('idx_conversation_id');
            Schema::hasIndex('magic_chat_topics', 'idx_topic_id') && $table->dropIndex('idx_topic_id');
            $table->index(['conversation_id', 'topic_id'], 'idx_conversation_topic');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('', function (Blueprint $table) {
        });
    }
};
