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
        if (! Schema::hasColumn('magic_model_audit_logs', 'access_scope')) {
            Schema::table('magic_model_audit_logs', function (Blueprint $table) {
                $table->string('access_scope', 32)
                    ->nullable()
                    ->after('detail_info')
                    ->comment('访问范围：api_platform=开放平台/API，magic=Magic 内应用');
                $table->index('access_scope', 'idx_magic_model_audit_logs_access_scope');
            });
        }

        if (! Schema::hasColumn('magic_model_audit_logs', 'magic_topic_id')) {
            Schema::table('magic_model_audit_logs', function (Blueprint $table) {
                $table->string('magic_topic_id', 64)
                    ->nullable()
                    ->after('access_scope')
                    ->comment('Magic 话题 ID，与 businessParams.magic_topic_id 一致');
                $table->index('magic_topic_id', 'idx_magic_model_audit_logs_magic_topic_id');
            });
        }

        if (! Schema::hasColumn('magic_model_audit_logs', 'points')) {
            $after = Schema::hasColumn('magic_model_audit_logs', 'magic_topic_id')
                ? 'magic_topic_id'
                : 'access_scope';
            Schema::table('magic_model_audit_logs', function (Blueprint $table) use ($after) {
                $table->bigInteger('points')
                    ->nullable()
                    ->after($after)
                    ->comment('本次调用关联积分，便于统计；与 businessParams.points 一致');
                $table->index('points', 'idx_magic_model_audit_logs_points');
            });
        }
    }

    public function down(): void
    {
        Schema::table('magic_model_audit_logs', function (Blueprint $table) {
            if (Schema::hasColumn('magic_model_audit_logs', 'points')) {
                $table->dropIndex('idx_magic_model_audit_logs_points');
                $table->dropColumn('points');
            }
            if (Schema::hasColumn('magic_model_audit_logs', 'magic_topic_id')) {
                $table->dropIndex('idx_magic_model_audit_logs_magic_topic_id');
                $table->dropColumn('magic_topic_id');
            }
            if (Schema::hasColumn('magic_model_audit_logs', 'access_scope')) {
                $table->dropIndex('idx_magic_model_audit_logs_access_scope');
                $table->dropColumn('access_scope');
            }
        });
    }
}
