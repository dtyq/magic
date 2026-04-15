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
        // 向量化结果缓存表
        // 用于缓存文本片段的向量化结果，避免重复计算，节省成本
        // 该表为多组织共享，不需要组织隔离
        if (! Schema::hasTable('embedding_cache')) {
            Schema::create('embedding_cache', static function (Blueprint $table) {
                $table->bigIncrements('id')->comment('自增主键');
                $table->char('text_hash', 64)->comment('文本内容的SHA256哈希值');
                $table->string('text_preview', 255)->comment('文本前255字符预览，用于调试和验证');
                $table->integer('text_length')->comment('原始文本长度');
                $table->json('embedding')->comment('向量化结果，存储为JSON数组格式');
                $table->string('embedding_model', 100)->comment('使用的嵌入模型名称');
                $table->integer('vector_dimension')->comment('向量维度');

                // 缓存使用统计
                $table->integer('access_count')->default(1)->comment('累计访问次数');
                $table->timestamp('last_accessed_at')->useCurrent()->comment('最后访问时间');

                // 时间戳
                $table->timestamp('created_at')->useCurrent()->comment('创建时间');
                $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate()->comment('更新时间');

                $table->comment('向量化结果缓存表，多组织共享，用于避免重复计算相同文本的向量');

                // 索引定义
                $table->unique(['text_hash', 'embedding_model'], 'uk_text_hash_model');
                $table->index(['last_accessed_at', 'access_count'], 'idx_last_accessed_access');
                $table->index(['access_count'], 'idx_access_count');
                $table->index(['created_at'], 'idx_created_at');

                $table->engine = 'InnoDB';
                $table->charset = 'utf8mb4';
                $table->collation = 'utf8mb4_unicode_ci';
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('embedding_cache');
    }
};
