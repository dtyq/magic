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
        if (Schema::hasTable('knowledge_third_file_revectorize_states')) {
            return;
        }

        Schema::create('knowledge_third_file_revectorize_states', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('organization_code', 255)->comment('组织编码');
            $table->string('third_platform_type', 64)->comment('第三方平台类型');
            $table->string('third_file_id', 255)->comment('第三方文件ID');
            $table->json('latest_payload')->comment('最近一次通知参数');
            $table->dateTime('last_execute_at')->nullable()->comment('最近一次执行占位时间');
            $table->dateTime('next_execute_at')->nullable()->comment('下一次允许执行时间');
            $table->string('status', 32)->default('idle')->comment('状态：idle/pending');
            $table->unsignedInteger('notification_count')->default(0)->comment('通知次数');
            $table->datetimes();

            $table->unique(
                ['organization_code', 'third_platform_type', 'third_file_id'],
                'uk_knowledge_third_file_revectorize_state'
            );
            $table->index(['status', 'next_execute_at'], 'idx_knowledge_third_file_revectorize_due');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_third_file_revectorize_states');
    }
};
