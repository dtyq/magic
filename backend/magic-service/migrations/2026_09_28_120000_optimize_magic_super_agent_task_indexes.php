<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * magic_super_agent_task 索引整治：
 *
 * - ADD idx_status_deleted_started：超时任务扫描
 *   （task_status IN (running,waiting) AND deleted_at IS NULL AND started_at < ? LIMIT 100）
 *   单列 idx_task_status 区分度不足时，优化器可能放弃索引而执行全表扫描。
 *   新索引按「IN 等值 → IS NULL 等值 → 范围」匹配，配合 LIMIT 尽早结束扫描。
 * - DROP idx_task_status：被 idx_status_deleted_started 最左前缀完全覆盖，纯冗余。
 * - DROP idx_task_project_id：项目维度的批量更新先经 topics 表换取 topic_id，
 *   不直接按 project_id 查询本表（见 BackfillFileParentIdCommand 路线 C 注释
 *   与 updateTaskByCondition 的维度守卫）。
 * - KEEP idx_user_workspace：保留按 user_id 最左前缀查询的兼容约束，不可删除。
 */
return new class extends Migration {
    private const TABLE_NAME = 'magic_super_agent_task';

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tableName = self::TABLE_NAME;
        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            // 超时扫描：WHERE task_status IN ('running','waiting') AND deleted_at IS NULL
            //          AND started_at < ? LIMIT 100（无 ORDER BY，LIMIT 触发索引早停）
            if (! Schema::hasIndex($tableName, 'idx_status_deleted_started')) {
                $table->index(['task_status', 'deleted_at', 'started_at'], 'idx_status_deleted_started');
            }

            // Redundant left-prefix of idx_status_deleted_started.
            if (Schema::hasIndex($tableName, 'idx_task_status')) {
                $table->dropIndex('idx_task_status');
            }

            // No query in any of the four services filters this table by project_id.
            if (Schema::hasIndex($tableName, 'idx_task_project_id')) {
                $table->dropIndex('idx_task_project_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     * Note: Rollback is handled by external audit system, not by script.
     * Manual rollback SQL if ever needed:
     *   ALTER TABLE magic_super_agent_task ADD INDEX idx_task_status (task_status), ADD INDEX idx_task_project_id (project_id);
     *   ALTER TABLE magic_super_agent_task DROP INDEX idx_status_deleted_started;.
     */
    public function down(): void
    {
    }
};
