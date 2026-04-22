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
        if (! Schema::hasTable('knowledge_source_binding_items')) {
            Schema::create('knowledge_source_binding_items', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('binding_id')->comment('来源绑定ID');
                $table->unsignedBigInteger('source_item_id')->comment('来源项ID');
                $table->string('resolve_reason', 255)->default('')->comment('命中原因');
                $table->dateTime('last_resolved_at')->nullable()->comment('最近解析时间');
                $table->datetimes();

                $table->unique(
                    ['binding_id', 'source_item_id'],
                    'uk_kb_source_binding_items'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_source_binding_items');
    }
};
