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
        if (Schema::hasTable('magic_model_audit_hourly_records')) {
            return;
        }

        Schema::create('magic_model_audit_hourly_records', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->date('stat_date');
            $table->dateTime('bucket_start_at');
            $table->string('organization_code', 64)->default('');
            $table->string('access_scope', 32)->default('');
            $table->unsignedBigInteger('service_provider_config_id')->default(0);
            $table->string('product_code', 255)->default('');
            $table->unsignedBigInteger('request_count')->default(0);
            $table->unsignedBigInteger('error_count')->default(0);
            $table->unsignedBigInteger('input_tokens')->default(0);
            $table->unsignedBigInteger('output_tokens')->default(0);
            $table->unsignedBigInteger('total_tokens')->default(0);
            $table->timestamps();

            $table->unique(
                ['organization_code', 'bucket_start_at', 'access_scope', 'service_provider_config_id', 'product_code'],
                'uk_model_audit_hourly_dimensions'
            );
            // 官方未带组织：统计 WHERE 只剩 bucket 范围
            $table->index(['bucket_start_at', 'organization_code'], 'idx_model_audit_hourly_bucket_org');
            // deleteDate / summarizeDate：WHERE stat_date = ?
            $table->index('stat_date', 'idx_model_audit_hourly_date');
            // 统计接口 service_provider_config_id：工作区必有 org，等值 IN + 时间范围
            $table->index(
                ['organization_code', 'service_provider_config_id', 'bucket_start_at'],
                'idx_model_audit_hourly_org_sp_bucket'
            );
            // 统计接口 product_code：前缀 LIKE 'x%' + 时间范围
            $table->index(
                ['organization_code', 'product_code', 'bucket_start_at'],
                'idx_model_audit_hourly_org_product_bucket'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_model_audit_hourly_records');
    }
};
