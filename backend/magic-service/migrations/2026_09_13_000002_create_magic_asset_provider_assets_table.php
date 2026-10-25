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
        Schema::create('magic_asset_provider_assets', function (Blueprint $table): void {
            $table->unsignedBigInteger('id')->primary();
            $table->unsignedBigInteger('asset_id')->comment('本地资产 ID');
            $table->string('organization_code', 32)->default('')->comment('组织编码');
            $table->string('provider_code', 64)->comment('Provider 标识');
            $table->string('project_name', 128)->default('')->comment('Provider 项目名称');
            $table->string('provider_asset_id', 128)->nullable()->comment('第三方资产 ID，组映射可为空');
            $table->string('provider_group_id', 128)->nullable()->comment('第三方资产组 ID');
            $table->string('provider_status', 32)->default('UNVERIFIED')->comment('第三方状态：UNVERIFIED未校验 PROCESSING处理中 PASS通过 FAILED失败');
            $table->string('provider_review_mode', 32)->default('VOLCENGINE')->comment('结论来源：VOLCENGINE 火山审核 NO_PERSON 无人像未注册 REUSED 复用已有素材');
            $table->string('provider_failed_reason', 512)->nullable()->comment('第三方同步或合规失败原因');
            $table->json('metadata')->nullable()->comment('第三方扩展元数据');
            $table->dateTime('created_at');
            $table->dateTime('updated_at');
            $table->dateTime('deleted_at')->nullable();
            $table->unique(['organization_code', 'asset_id', 'provider_code', 'project_name'], 'uniq_asset_provider_mapping');
            $table->index(['organization_code', 'provider_asset_id'], 'idx_asset_provider_external');
            $table->index(['provider_code', 'provider_asset_id', 'provider_group_id'], 'idx_asset_provider_usage');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_asset_provider_assets');
    }
};
