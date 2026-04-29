<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddAccessTokenNameModelVersionProviderNameToMagicModelAuditLogsTable extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('magic_model_audit_logs')) {
            return;
        }

        Schema::table('magic_model_audit_logs', function (Blueprint $table) {
            // 快照字段：调用时的 API Key 名称、模型部署名、服务商名称，避免事后关联查询时数据已变更
            if (! Schema::hasColumn('magic_model_audit_logs', 'access_token_name')) {
                $table->string('access_token_name', 255)
                    ->default('')
                    ->after('ak')
                    ->comment('API Key 名称快照，来自 magic_api_access_tokens.name');
            }
            if (! Schema::hasColumn('magic_model_audit_logs', 'model_version')) {
                $table->string('model_version', 255)
                    ->default('')
                    ->after('product_code')
                    ->comment('模型部署名称快照（发给上游的真实 model id），来自 service_provider_models.model_version');
            }
            if (! Schema::hasColumn('magic_model_audit_logs', 'provider_name')) {
                $table->string('provider_name', 255)
                    ->default('')
                    ->after('model_version')
                    ->comment('服务商名称快照，来自 service_provider_configs.alias 或 service_provider.name');
            }

            // 加速管理端列表筛选与统计，避免大表全表扫描
            if (! Schema::hasIndex('magic_model_audit_logs', 'idx_magic_model_audit_logs_operation_time')) {
                $table->index('operation_time', 'idx_magic_model_audit_logs_operation_time');
            }
            if (! Schema::hasIndex('magic_model_audit_logs', 'idx_magic_model_audit_logs_model_version')) {
                $table->index('model_version', 'idx_magic_model_audit_logs_model_version');
            }
            if (! Schema::hasIndex('magic_model_audit_logs', 'idx_magic_model_audit_logs_provider_name')) {
                $table->index('provider_name', 'idx_magic_model_audit_logs_provider_name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('magic_model_audit_logs', function (Blueprint $table) {
            $table->dropIndex('idx_magic_model_audit_logs_provider_name');
            $table->dropIndex('idx_magic_model_audit_logs_model_version');
            $table->dropIndex('idx_magic_model_audit_logs_operation_time');
            $table->dropColumn(['provider_name', 'model_version', 'access_token_name']);
        });
    }
}
