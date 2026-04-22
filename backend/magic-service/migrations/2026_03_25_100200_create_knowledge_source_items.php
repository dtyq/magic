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
        if (! Schema::hasTable('knowledge_source_items')) {
            Schema::create('knowledge_source_items', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('organization_code', 255)->comment('组织编码');
                $table->string('provider', 64)->comment('来源提供方');
                $table->string('root_type', 64)->comment('来源根类型');
                $table->string('root_ref', 255)->comment('来源根引用');
                $table->string('group_ref', 255)->default('')->comment('目录/分组引用');
                $table->string('item_type', 32)->default('file')->comment('来源项类型');
                $table->string('item_ref', 255)->comment('来源项引用');
                $table->string('display_name', 255)->default('')->comment('展示名称');
                $table->string('extension', 64)->default('')->comment('扩展名');
                $table->string('content_hash', 255)->default('')->comment('内容摘要');
                $table->json('snapshot_meta')->nullable()->comment('来源快照元数据');
                $table->dateTime('last_resolved_at')->nullable()->comment('最近解析时间');
                $table->datetimes();

                $table->unique(
                    ['organization_code', 'provider', 'item_ref'],
                    'uk_kb_source_items_provider_item'
                );
                $table->index(
                    ['item_ref', 'id'],
                    'idx_kb_source_items_item_ref'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_source_items');
    }
};
