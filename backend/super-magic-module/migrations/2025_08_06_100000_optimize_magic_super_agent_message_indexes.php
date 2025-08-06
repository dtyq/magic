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
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            // ============ 场景优化索引 ============

            // 场景1: topic_id + task_id + seq_id (倒序)
            // 用于按序列ID倒序查询特定topic和task的消息
            $table->index(['topic_id', 'task_id', 'seq_id'], 'idx_topic_task_seq_desc');

            // 场景2: topic_id + task_id + sender_type + processing_status
            // 用于查询特定topic和task下指定发送者类型和处理状态的消息
            $table->index(['topic_id', 'task_id', 'sender_type', 'processing_status'], 'idx_topic_task_sender_status');

            // 场景3: topic_id + message_id
            // 用于在特定topic下查找消息，虽然message_id有唯一索引，但加上topic_id可以提升查询效率
            $table->index(['topic_id', 'message_id'], 'idx_topic_message');

            // 场景4: processing_status + created_at
            // 用于按处理状态和创建时间查询，常用于队列处理和监控
            $table->index(['processing_status', 'created_at'], 'idx_status_created');

            // ============ 删除指定的旧索引 ============

            // 检查并删除重复的id索引（主键已经包含）
            if (Schema::hasIndex('magic_super_agent_message', 'idx_id')) {
                $table->dropIndex('idx_id');
            }

            // 检查并删除重复的message_id索引（后续会删除唯一索引）
            if (Schema::hasIndex('magic_super_agent_message', 'idx_message_id')) {
                $table->dropIndex('idx_message_id');
            }

            // 检查并删除task_type索引
            if (Schema::hasIndex('magic_super_agent_message', 'idx_task_type')) {
                $table->dropIndex('idx_task_type');
            }

            // 检查并删除sender_created索引
            if (Schema::hasIndex('magic_super_agent_message', 'idx_sender_created')) {
                $table->dropIndex('idx_sender_created');
            }

            // 检查并删除receiver_created索引
            if (Schema::hasIndex('magic_super_agent_message', 'idx_receiver_created')) {
                $table->dropIndex('idx_receiver_created');
            }

            // 请确认业务逻辑中有其他方式保证message_id的唯一性
            if (Schema::hasIndex('magic_super_agent_message', 'magic_super_agent_message_message_id_unique')) {
                $table->dropUnique('magic_super_agent_message_message_id_unique');
            }

            // 保留: idx_topic_show_deleted (topic_id, show_in_ui, deleted_at)
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            // 删除新增的索引
            $table->dropIndex('idx_topic_task_seq_desc');
            $table->dropIndex('idx_topic_task_sender_status');
            $table->dropIndex('idx_topic_message');
            $table->dropIndex('idx_status_created');

            // 恢复被删除的所有索引
            $table->index(['id'], 'idx_id');
            $table->index(['message_id'], 'idx_message_id');
            $table->index(['task_id', 'type'], 'idx_task_type');
            $table->index(['sender_uid', 'created_at'], 'idx_sender_created');
            $table->index(['receiver_uid', 'created_at'], 'idx_receiver_created');
            $table->unique(['message_id'], 'magic_super_agent_message_message_id_unique');

            // 注意：idx_topic_show_deleted 保留，无需恢复
        });
    }
};
