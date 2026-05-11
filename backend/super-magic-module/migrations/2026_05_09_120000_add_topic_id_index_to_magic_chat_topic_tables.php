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
        // magic_chat_topics 历史上有过 idx_topic_id，被联合索引 (conversation_id, topic_id) 取代。
        // 联合索引在仅按 topic_id 查询时不会被走最左前缀，这里把单列索引补回来。
        if (Schema::hasTable('magic_chat_topics')
            && ! Schema::hasIndex('magic_chat_topics', 'idx_topic_id')
        ) {
            Schema::table('magic_chat_topics', function (Blueprint $table) {
                $table->index(['topic_id'], 'idx_topic_id');
            });
        }

        // magic_chat_topic_messages 当前只有 (conversation_id, topic_id) 联合索引，
        // 仅按 topic_id 拉消息的场景需要单列索引来命中。
        if (Schema::hasTable('magic_chat_topic_messages')
            && ! Schema::hasIndex('magic_chat_topic_messages', 'idx_topic_id')
        ) {
            Schema::table('magic_chat_topic_messages', function (Blueprint $table) {
                $table->index(['topic_id'], 'idx_topic_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('magic_chat_topics')
            && Schema::hasIndex('magic_chat_topics', 'idx_topic_id')
        ) {
            Schema::table('magic_chat_topics', function (Blueprint $table) {
                $table->dropIndex('idx_topic_id');
            });
        }

        if (Schema::hasTable('magic_chat_topic_messages')
            && Schema::hasIndex('magic_chat_topic_messages', 'idx_topic_id')
        ) {
            Schema::table('magic_chat_topic_messages', function (Blueprint $table) {
                $table->dropIndex('idx_topic_id');
            });
        }
    }
};
