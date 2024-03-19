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
        // 添加 service_provider_models 表的索引
        Schema::table('service_provider_models', function (Blueprint $table) {
            // 删除旧的 model_parent_id_status 索引（如果存在）
            if (Schema::hasIndex('service_provider_models', 'service_provider_models_model_parent_id_status_index')) {
                $table->dropIndex('service_provider_models_model_parent_id_status_index');
            }

            // 删除旧的 idx_organization_code_status_model_version 索引（如果存在）
            if (Schema::hasIndex('service_provider_models', 'idx_organization_code_status_model_version')) {
                $table->dropIndex('idx_organization_code_status_model_version');
            }

            // 删除旧的 idx_model_id_status_organization_code 索引（如果存在）
            if (Schema::hasIndex('service_provider_models', 'idx_model_id_status_organization_code')) {
                $table->dropIndex('idx_model_id_status_organization_code');
            }

            // 添加组织+状态+类别索引（如果不存在）
            if (! Schema::hasIndex('service_provider_models', 'idx_organization_status_category')) {
                $table->index(['organization_code', 'status', 'category'], 'idx_organization_status_category');
            }

            // 添加组织+配置ID索引（如果不存在）
            if (! Schema::hasIndex('service_provider_models', 'idx_organization_code_config_id')) {
                $table->index(['organization_code', 'service_provider_config_id'], 'idx_organization_code_config_id');
            }

            // 添加新的组合索引：organization_code, model_parent_id（如果不存在）
            if (! Schema::hasIndex('service_provider_models', 'idx_org_model_parent')) {
                $table->index(['organization_code', 'model_parent_id'], 'idx_org_model_parent');
            }
        });

        // 添加 service_provider_configs 表的索引
        Schema::table('service_provider_configs', function (Blueprint $table) {
            // 组织+状态联合索引（如果不存在）
            if (! Schema::hasIndex('service_provider_configs', 'idx_org_status')) {
                $table->index(['organization_code', 'status'], 'idx_org_status');
            }

            // 组织+服务商ID联合索引（如果不存在）
            if (! Schema::hasIndex('service_provider_configs', 'idx_org_provider_id')) {
                $table->index(['organization_code', 'service_provider_id'], 'idx_org_provider_id');
            }
        });

        // 添加 service_provider_original_models 表的索引
        Schema::table('service_provider_original_models', function (Blueprint $table) {
            // 核心组合索引（如果不存在）
            if (! Schema::hasIndex('service_provider_original_models', 'idx_org_type')) {
                $table->index(['organization_code', 'type'], 'idx_org_type');
            }

            // 类型+组织+模型ID联合索引（如果不存在）
            if (! Schema::hasIndex('service_provider_original_models', 'idx_type_org_id')) {
                $table->index(['type', 'organization_code', 'model_id'], 'idx_type_org_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
