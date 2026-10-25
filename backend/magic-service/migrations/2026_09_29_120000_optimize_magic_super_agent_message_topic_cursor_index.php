<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

/*
 * magic_super_agent_message index change (this stage):
 * - ADD  idx_topic_show_deleted_id (topic_id, show_in_ui, deleted_at, id)
 * - DROP idx_topic_show_deleted    (topic_id, show_in_ui, deleted_at)
 * The other four DROPs of this stage are in 2026_09_29_130000_drop_unused_indexes_from_magic_super_agent_message.
 * The message list cursor query (ORDER BY id) was misled by the old index into a PRIMARY scan.
 * The DBA runs the same two statements on production first; the hasIndex guards then skip them.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('magic_super_agent_message')) {
            return;
        }

        if (! Schema::hasIndex('magic_super_agent_message', 'idx_topic_show_deleted_id')) {
            Db::statement(
                'ALTER TABLE magic_super_agent_message '
                . 'ADD INDEX idx_topic_show_deleted_id '
                . '(topic_id, show_in_ui, deleted_at, id), '
                . 'ALGORITHM=INPLACE, LOCK=NONE'
            );
        }

        if (Schema::hasIndex('magic_super_agent_message', 'idx_topic_show_deleted')) {
            Db::statement(
                'ALTER TABLE magic_super_agent_message '
                . 'DROP INDEX idx_topic_show_deleted, '
                . 'ALGORITHM=INPLACE, LOCK=NONE'
            );
        }
    }

    public function down(): void
    {
    }
};
