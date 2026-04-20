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
        if (! Schema::hasTable('knowledge_source_bindings')) {
            Schema::create('knowledge_source_bindings', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('organization_code', 255)->comment('组织编码');
                $table->string('knowledge_base_code', 255)->comment('知识库编码');
                $table->string('provider', 64)->comment('来源提供方');
                $table->string('root_type', 64)->comment('来源根类型');
                $table->string('root_ref', 255)->comment('来源根引用');
                $table->string('sync_mode', 32)->default('manual')->comment('同步模式');
                $table->json('sync_config')->nullable()->comment('同步配置');
                $table->boolean('enabled')->default(true)->comment('是否启用');
                $table->string('created_uid', 255)->default('')->comment('创建者ID');
                $table->string('updated_uid', 255)->default('')->comment('更新者ID');
                $table->datetimes();

                $table->unique(
                    ['knowledge_base_code', 'provider', 'root_type', 'root_ref'],
                    'uk_kb_source_bindings_root'
                );
                $table->index(
                    ['organization_code', 'provider', 'root_type', 'root_ref', 'sync_mode'],
                    'idx_kb_source_bindings_org_root_sync'
                );
                $table->index(
                    ['provider', 'root_ref', 'id'],
                    'idx_kb_source_bindings_provider_root'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_source_bindings');
    }
};
