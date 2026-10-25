<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    /** 创建模型标识映射表及查询所需索引。 */
    public function up(): void
    {
        if (Schema::hasTable('magic_model_identifier_mappings')) {
            return;
        }

        Schema::create('magic_model_identifier_mappings', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('group_id', 64)->comment('映射组标识');
            $table->string('group_name', 100)->comment('映射组名称');
            $table->string('source_model_id', 100)->comment('源模型标识');
            $table->string('target_model_id', 100)->comment('目标模型标识');
            $table->tinyInteger('status')->default(1)->comment('状态：0-停用，1-启用');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['group_id', 'deleted_at'], 'idx_model_mapping_group_deleted');
            $table->index(['status', 'deleted_at'], 'idx_model_mapping_status_deleted');
            $table->index('target_model_id', 'idx_model_mapping_target');
            // 源标识在有效记录中必须唯一；软删除后允许再次配置。
            $table->unique(['source_model_id', 'deleted_at'], 'uk_model_mapping_source_deleted');
        });
    }

    public function down(): void
    {
    }
};
