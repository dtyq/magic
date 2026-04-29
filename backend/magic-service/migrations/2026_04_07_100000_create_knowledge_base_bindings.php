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
        if (! Schema::hasTable('knowledge_base_bindings')) {
            Schema::create('knowledge_base_bindings', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('knowledge_base_code', 255)->default('')->comment('知识库编码');
                $table->string('bind_type', 64)->default('')->comment('绑定对象类型');
                $table->string('bind_id', 255)->default('')->comment('绑定对象ID');
                $table->string('organization_code', 255)->default('')->comment('组织编码');
                $table->string('created_uid', 255)->default('')->comment('创建者ID');
                $table->string('updated_uid', 255)->default('')->comment('更新者ID');
                $table->datetimes();

                $table->unique(
                    ['knowledge_base_code', 'bind_type', 'bind_id'],
                    'uk_kb_bindings'
                );
                $table->index(
                    ['organization_code', 'bind_type', 'bind_id'],
                    'idx_kb_bindings_org_bind'
                );
                $table->index(
                    ['organization_code', 'knowledge_base_code'],
                    'idx_kb_bindings_org_kb'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_base_bindings');
    }
};
