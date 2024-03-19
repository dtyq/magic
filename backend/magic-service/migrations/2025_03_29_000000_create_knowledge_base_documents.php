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
        Schema::create('knowledge_base_documents', function (Blueprint $table) {
            // 主键
            $table->bigIncrements('id');

            // 关联字段
            $table->string('knowledge_base_code', 255)->comment('关联知识库code')->index();

            // 文档元数据
            $table->string('name', 255)->comment('文档名称');
            $table->string('description', 255)->comment('描述');
            $table->string('code', 255)->comment('文档code');
            $table->unsignedInteger('version')->default(1)->comment('版本');
            $table->boolean('enabled')->default(true)->comment('1 启用 0 禁用');
            $table->unsignedInteger('doc_type')->comment('文档类型');
            $table->json('doc_metadata')->nullable()->comment('文档元数据');
            $table->tinyInteger('sync_status')->default(0)->comment('同步状态');
            $table->tinyInteger('sync_times')->default(0)->comment('同步次数');
            $table->string('sync_status_message', 1000)->default('')->comment('同步状态消息');
            $table->string('organization_code')->comment('组织编码');
            $table->unsignedBigInteger('word_count')->default(0)->comment('字数统计');

            // 配置信息
            $table->string('embedding_model', 255)->comment('嵌入模型');
            $table->string('vector_db', 255)->comment('向量数据库');
            $table->json('retrieve_config')->nullable()->comment('检索配置');
            $table->json('fragment_config')->nullable()->comment('分段配置');
            $table->json('embedding_config')->nullable()->comment('嵌入配置');
            $table->json('vector_db_config')->nullable()->comment('向量数据库配置');

            // 操作记录
            $table->string('created_uid', 255)->comment('创建者ID');
            $table->string('updated_uid', 255)->comment('更新者ID');

            // 状态时间点
            $table->datetimes();
            $table->softDeletes();

            $table->unique(['code', 'version'], 'unique_code_version');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('knowledge_base_documents');
    }
};
