<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddFirstResponseLatencyToMagicModelAuditLogsTable extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('magic_model_audit_logs')) {
            return;
        }

        Schema::table('magic_model_audit_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_model_audit_logs', 'event_id')) {
                $table->string('event_id', 64)
                    ->nullable()
                    ->after('request_id')
                    ->comment('事件唯一 ID，雪花 ID 字符串，用于审计与计费关联');
            }

            if (! Schema::hasIndex('magic_model_audit_logs', 'uk_magic_model_audit_logs_event_id', 'unique')) {
                $table->unique('event_id', 'uk_magic_model_audit_logs_event_id');
            }

            // 仅流式调用有语义；非流式保持 0
            if (! Schema::hasColumn('magic_model_audit_logs', 'first_response_latency')) {
                $table->unsignedInteger('first_response_latency')
                    ->default(0)
                    ->after('all_latency')
                    ->comment('流式首次 Token 响应延时（TTFT，毫秒），非流式为 0');
            }
        });
    }

    public function down(): void
    {
        Schema::table('magic_model_audit_logs', function (Blueprint $table) {
            $table->dropUnique('uk_magic_model_audit_logs_event_id');
            $table->dropColumn('event_id');
            $table->dropColumn('first_response_latency');
        });
    }
}
