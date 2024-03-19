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
        Schema::create('knowledge_base_parent_fragments', function (Blueprint $table) {
            // 主键
            $table->bigIncrements('id');

            // 元数据
            $table->string('knowledge_base_code', 255);
            $table->string('knowledge_base_document_code', 255)->comment('关联知识库文档code');
            $table->string('organization_code')->comment('组织编码');

            // 操作记录
            $table->string('created_uid', 255)->comment('创建者ID');
            $table->string('updated_uid', 255)->comment('更新者ID');

            // 状态时间点
            $table->datetimes();
            $table->softDeletes();

            $table->index(['knowledge_base_code', 'knowledge_base_document_code'], 'index_knowledge_base_code_document_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('knowledge_base_parent_fragments');
    }
};
