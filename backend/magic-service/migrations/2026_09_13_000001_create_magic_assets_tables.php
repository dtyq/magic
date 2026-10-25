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
        Schema::create('magic_assets', function (Blueprint $table): void {
            $table->unsignedBigInteger('id')->primary();
            $table->string('organization_code', 32)->default('')->comment('组织编码');
            $table->string('user_id', 64)->nullable()->comment('创建用户，公开资产可为空');
            $table->string('owner_uid', 64)->nullable()->comment('当前归属人用户 ID');
            $table->string('asset_kind', 32)->default('ASSET')->comment('资产容器类型：ASSET/GROUP');
            $table->string('asset_business_type', 64)->default('')->comment('资产业务类型');
            $table->unsignedBigInteger('parent_id')->nullable()->comment('父资产组 ID');
            $table->string('asset_media_type', 64)->nullable()->comment('媒体分类：IMAGE、VIDEO、AUDIO');
            $table->json('name_i18n')->comment('多语言名称');
            $table->json('description_i18n')->nullable()->comment('多语言描述');
            $table->text('search_text')->nullable()->comment('名称、描述和标签名称聚合搜索文本');
            $table->string('file_key', 512)->nullable()->comment('对象存储文件 key');
            $table->string('content_hash', 64)->nullable()->comment('内容 SHA-256');
            $table->boolean('status')->default(true)->comment('是否显示');
            $table->string('visibility_type', 16)->default('PERSONAL')->comment('可见范围：PERSONAL 仅自己可见，TEAM 团队可见');
            $table->json('visibility')->nullable()->comment('可见范围配置');
            $table->json('metadata')->nullable()->comment('扩展元数据');
            $table->dateTime('created_at');
            $table->dateTime('updated_at');
            $table->dateTime('deleted_at')->nullable();
            $table->index(['organization_code', 'user_id', 'asset_kind', 'parent_id'], 'idx_asset_owner_kind_parent');
            $table->index(['organization_code', 'owner_uid'], 'idx_asset_org_owner');
            $table->index(['organization_code', 'status'], 'idx_asset_org_status');
            $table->index(['content_hash'], 'idx_asset_content_hash');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_assets');
    }
};
