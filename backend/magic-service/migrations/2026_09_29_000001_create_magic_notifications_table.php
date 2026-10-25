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
        Schema::create('magic_notifications', function (Blueprint $table): void {
            $table->unsignedBigInteger('id')->primary()->comment('消息 ID');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->string('recipient_user_id', 128)->comment('收件人用户 ID');
            $table->string('category', 32)->comment('消息分类：system/authorization');
            $table->string('type', 64)->comment('消息类型');
            $table->unsignedInteger('template_version')->comment('模板版本');
            $table->json('payload')->comment('模板渲染参数');
            $table->string('source_event_key', 255)->comment('消息幂等键');
            $table->string('source_domain', 64)->comment('业务域');
            $table->string('source_type', 64)->comment('业务身份类型');
            $table->string('source_id', 128)->comment('业务记录 ID');
            $table->string('source_version', 64)->nullable()->comment('业务身份版本');
            $table->string('message_status', 32)->default('active')->comment('消息状态');
            $table->dateTime('read_at')->nullable()->comment('系统通知已读时间');
            $table->string('action_status', 32)->default('none')->comment('授权动作状态');
            $table->dateTime('actioned_at')->nullable()->comment('授权动作时间');
            $table->string('actioned_by', 128)->nullable()->comment('实际操作用户');
            $table->dateTime('created_at')->comment('创建时间');
            $table->dateTime('updated_at')->comment('更新时间');

            $table->unique(['source_event_key', 'recipient_user_id'], 'uniq_notification_source_recipient');
            $table->index(
                ['organization_code', 'recipient_user_id', 'created_at', 'id'],
                'idx_notification_recipient_created'
            );
            $table->index(
                ['organization_code', 'recipient_user_id', 'category', 'message_status', 'read_at'],
                'idx_notification_read_status'
            );
            $table->index(
                ['organization_code', 'recipient_user_id', 'category', 'message_status', 'action_status'],
                'idx_notification_action_status'
            );
            $table->index(
                ['organization_code', 'source_domain', 'source_type', 'source_id', 'source_version'],
                'idx_notification_source_identity'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_notifications');
    }
};
