<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * magic_super_agent_topics 索引整治：
 *
 * - ADD idx_sandbox_id：getTopicBySandboxId / updateTopicStatusBySandboxIds 需要避免全表扫描；
 *   全表扫描 UPDATE 会对扫描行加 next-key lock，增加锁竞争风险。
 *   sandbox_id 区分度极高（一个沙箱对应少量话题），单列即可，不加 current_task_status。
 * - ADD idx_chat_topic_id：getTopicById 的 chat_topic_id 兜底与 getTopicOnlyByChatTopicId
 *   需要避免全表扫描。chat_topic_id 检索仍需保留，
 *   兜底路径短期不可移除，加索引止血。列 DEFAULT ''，存量多行空串，禁止建成 UNIQUE。
 *   若后续兜底调用方完成迁移并移除检索路径，须随之 DROP 本索引。
 * - DROP idx_project_id：被 idx_project_task_status 与 idx_project_user_hidden
 *   左前缀完全覆盖，纯冗余，只增加写入放大和优化器选择噪音。
 */
return new class extends Migration {
    private const TABLE_NAME = 'magic_super_agent_topics';

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tableName = self::TABLE_NAME;
        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            // Sandbox 定位查询与批量状态更新：WHERE sandbox_id IN (?) [AND current_task_status IN (?)]
            if (! Schema::hasIndex($tableName, 'idx_sandbox_id')) {
                $table->index(['sandbox_id'], 'idx_sandbox_id');
            }

            // chat_topic_id fallback in getTopicById and getTopicOnlyByChatTopicId:
            // WHERE deleted_at IS NULL AND chat_topic_id = ? LIMIT 1.
            // Must NOT be unique — the column defaults to '' and many legacy rows share it.
            if (! Schema::hasIndex($tableName, 'idx_chat_topic_id')) {
                $table->index(['chat_topic_id'], 'idx_chat_topic_id');
            }

            // Redundant left-prefix of idx_project_task_status / idx_project_user_hidden.
            if (Schema::hasIndex($tableName, 'idx_project_id')) {
                $table->dropIndex('idx_project_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     * Note: Rollback is handled by external audit system, not by script.
     * Manual rollback SQL if ever needed:
     *   ALTER TABLE magic_super_agent_topics ADD INDEX idx_project_id (project_id);
     *   ALTER TABLE magic_super_agent_topics DROP INDEX idx_sandbox_id, DROP INDEX idx_chat_topic_id;.
     */
    public function down(): void
    {
    }
};
