<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * magic_super_agent_message index change (this stage, together with 2026_09_29_120000):
 * - ADD  idx_topic_show_deleted_id     (in 2026_09_29_120000)
 * - DROP idx_topic_show_deleted        (in 2026_09_29_120000)
 * - DROP idx_status_created            (this file)
 * - DROP idx_correlation_id            (this file)
 * - DROP idx_topic_task_sender_status  (this file)
 * - DROP idx_topic_deleted_status_id   (this file)
 * The DBA runs the same changes on production first; the hasIndex guards then skip them.
 */
return new class extends Migration {
    private const TABLE_NAME = 'magic_super_agent_message';

    public function up(): void
    {
        $tableName = self::TABLE_NAME;
        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            // Only consumer was the message compensation crontab, which has been removed.
            if (Schema::hasIndex($tableName, 'idx_status_created')) {
                $table->dropIndex('idx_status_created');
            }

            // No query filters this table by correlation_id.
            if (Schema::hasIndex($tableName, 'idx_correlation_id')) {
                $table->dropIndex('idx_correlation_id');
            }

            // findCompletedResultMessages is served by idx_topic_task_seq_desc (same plan and latency without it).
            if (Schema::hasIndex($tableName, 'idx_topic_task_sender_status')) {
                $table->dropIndex('idx_topic_task_sender_status');
            }

            // The unread id-cursor query is served by idx_topic_deleted_status_created_at (same latency without it).
            if (Schema::hasIndex($tableName, 'idx_topic_deleted_status_id')) {
                $table->dropIndex('idx_topic_deleted_status_id');
            }
        });
    }

    /**
     * Rollback is handled manually. Manual rollback SQL if ever needed:
     *   ALTER TABLE magic_super_agent_message ADD INDEX idx_status_created (processing_status, created_at);
     *   ALTER TABLE magic_super_agent_message ADD INDEX idx_correlation_id (correlation_id);
     *   ALTER TABLE magic_super_agent_message ADD INDEX idx_topic_task_sender_status (topic_id, task_id, sender_type, processing_status);
     *   ALTER TABLE magic_super_agent_message ADD INDEX idx_topic_deleted_status_id (topic_id, deleted_at, status, id);.
     */
    public function down(): void
    {
    }
};
