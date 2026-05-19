<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddAccessScopeMagicTopicIdPointsToMagicModelAuditLogsTable extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('magic_model_audit_logs')) {
            return;
        }

        Schema::table('magic_model_audit_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_model_audit_logs', 'access_scope')) {
                $table->string('access_scope', 32)
                    ->nullable()
                    ->after('detail_info')
                    ->comment('访问范围：api_platform=开放平台/API，magic=Magic 内应用');
            }
            if (! Schema::hasColumn('magic_model_audit_logs', 'magic_topic_id')) {
                $table->string('magic_topic_id', 64)
                    ->nullable()
                    ->after('access_scope')
                    ->comment('Magic 话题 ID，与 businessParams.magic_topic_id 一致');
            }
            if (! Schema::hasColumn('magic_model_audit_logs', 'points')) {
                $table->bigInteger('points')
                    ->nullable()
                    ->after('magic_topic_id')
                    ->comment('本次调用关联积分，便于统计；与 businessParams.points 一致');
            }
            if (! Schema::hasColumn('magic_model_audit_logs', 'request_id')) {
                $table->string('request_id', 128)
                    ->nullable()
                    ->after('points')
                    ->comment('请求/链路 ID，与 businessParams.request_id 一致');
            }

            if (! Schema::hasIndex('magic_model_audit_logs', 'idx_magic_model_audit_logs_access_scope')) {
                $table->index('access_scope', 'idx_magic_model_audit_logs_access_scope');
            }
            if (! Schema::hasIndex('magic_model_audit_logs', 'idx_magic_model_audit_logs_magic_topic_id')) {
                $table->index('magic_topic_id', 'idx_magic_model_audit_logs_magic_topic_id');
            }
            if (! Schema::hasIndex('magic_model_audit_logs', 'idx_magic_model_audit_logs_points')) {
                $table->index('points', 'idx_magic_model_audit_logs_points');
            }
            if (! Schema::hasIndex('magic_model_audit_logs', 'idx_magic_model_audit_logs_request_id')) {
                $table->index('request_id', 'idx_magic_model_audit_logs_request_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('magic_model_audit_logs', function (Blueprint $table) {
            $table->dropIndex('idx_magic_model_audit_logs_request_id');
            $table->dropIndex('idx_magic_model_audit_logs_points');
            $table->dropIndex('idx_magic_model_audit_logs_magic_topic_id');
            $table->dropIndex('idx_magic_model_audit_logs_access_scope');
            $table->dropColumn(['request_id', 'points', 'magic_topic_id', 'access_scope']);
        });
    }
}
