<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('magic_model_audit_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_model_audit_logs', 'service_provider_config_id')) {
                $table->unsignedBigInteger('service_provider_config_id')
                    ->nullable()
                    ->after('event_id')
                    ->comment('服务商配置ID快照，来自 service_provider_configs.id');
            }
            if (! Schema::hasIndex('magic_model_audit_logs', 'idx_magic_model_audit_logs_sp_config_id')) {
                $table->index('service_provider_config_id', 'idx_magic_model_audit_logs_sp_config_id');
            }
        });
    }
};
