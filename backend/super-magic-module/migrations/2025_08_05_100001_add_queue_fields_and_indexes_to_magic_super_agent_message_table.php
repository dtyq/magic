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
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            // ============ 添加队列处理字段 ============

            // 添加原始数据存储字段
            $table->longText('raw_data')->nullable()->comment('原始投递消息JSON数据')->after('mentions');

            // 添加序列ID字段，用于严格排序
            $table->bigInteger('seq_id')->unsigned()->nullable()->comment('序列ID，用于消息排序')->after('raw_data');

            // 添加处理状态字段
            $table->enum('processing_status', ['pending', 'processing', 'completed', 'failed'])
                ->default('pending')
                ->comment('消息处理状态：pending-待处理，processing-处理中，completed-已完成，failed-失败')
                ->after('seq_id');

            // 添加错误信息字段
            $table->text('error_message')->nullable()->comment('处理失败时的错误信息')->after('processing_status');

            // 添加重试次数字段
            $table->tinyInteger('retry_count')->unsigned()->default(0)->comment('重试次数')->after('error_message');

            // 添加处理完成时间
            $table->timestamp('processed_at')->nullable()->comment('处理完成时间')->after('retry_count');

            // ============ 添加队列处理索引 ============

            // 主要查询索引：topic_id + processing_status + sender_type + seq_id 升序
            $table->index(['topic_id', 'processing_status', 'sender_type', 'seq_id'], 'idx_topic_status_sender_seq');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            // 删除索引
            $table->dropIndex('idx_topic_status_sender_seq');
            $table->dropIndex('idx_status_seq_asc');
            $table->dropIndex('idx_status_created');
            $table->dropIndex('idx_status_retry_created');
            $table->dropIndex('idx_seq_id');
            $table->dropIndex('idx_task_status');

            // 删除字段
            $table->dropColumn([
                'raw_data',
                'seq_id',
                'processing_status',
                'error_message',
                'retry_count',
                'processed_at',
            ]);
        });
    }
};
