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
        if (! Schema::hasTable('knowledge_source_binding_targets')) {
            Schema::create('knowledge_source_binding_targets', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('binding_id')->comment('来源绑定ID');
                $table->string('target_type', 32)->comment('目标类型 group/file');
                $table->string('target_ref', 255)->comment('目标引用');
                $table->datetimes();

                $table->unique(
                    ['binding_id', 'target_type', 'target_ref'],
                    'uk_kb_source_binding_targets'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_source_binding_targets');
    }
};
