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
        Schema::create('magic_notification_events', function (Blueprint $table): void {
            $table->unsignedBigInteger('id')->primary()->comment('表内主键');
            $table->string('event_id', 32)->comment('业务事件 ID');
            $table->string('event_type', 128)->comment('事件类型');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->string('source_domain', 64)->comment('业务域');
            $table->string('source_type', 64)->comment('业务身份类型');
            $table->string('source_id', 128)->comment('业务身份 ID');
            $table->string('source_version', 64)->nullable()->comment('业务身份版本');
            $table->json('event_payload')->comment('原始事件信封');
            $table->string('status', 32)->default('pending')->comment('消费状态');
            $table->unsignedInteger('attempts')->default(0)->comment('自动消费次数');
            $table->unsignedInteger('manual_retry_count')->default(0)->comment('人工重试次数');
            $table->unsignedInteger('recipient_count')->default(0)->comment('收件人数');
            $table->unsignedInteger('notification_count')->default(0)->comment('生成或更新的消息数');
            $table->dateTime('next_retry_at')->nullable()->comment('下一次自动重试时间');
            $table->string('last_error_code', 128)->nullable()->comment('最近错误码');
            $table->text('last_error_message')->nullable()->comment('最近错误信息');
            $table->string('processing_token', 64)->nullable()->comment('消费租约令牌');
            $table->dateTime('locked_until')->nullable()->comment('消费租约到期时间');
            $table->dateTime('last_started_at')->nullable()->comment('最近开始消费时间');
            $table->dateTime('last_finished_at')->nullable()->comment('最近完成时间');
            $table->string('last_retry_operator_id', 128)->nullable()->comment('最近人工重试操作人');
            $table->string('last_retry_reason', 500)->nullable()->comment('最近人工重试原因');
            $table->dateTime('last_retry_at')->nullable()->comment('最近人工重试时间');
            $table->dateTime('created_at')->comment('创建时间');
            $table->dateTime('updated_at')->comment('更新时间');

            $table->unique('event_id', 'uniq_notification_event_id');
            $table->index(['status', 'next_retry_at'], 'idx_notification_event_retry');
            $table->index(['status', 'locked_until'], 'idx_notification_event_lock');
            $table->index(['organization_code', 'created_at'], 'idx_notification_event_organization');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_notification_events');
    }
};
