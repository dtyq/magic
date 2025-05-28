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
        if (Schema::hasTable('magic_super_agent_token_usage_records')) {
            return;
        }
        Schema::create('magic_super_agent_token_usage_records', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('topic_id')->comment('话题ID');
            $table->string('task_id', 64)->comment('任务ID');
            $table->string('sandbox_id', 64)->nullable()->comment('沙箱ID');
            $table->string('organization_code', 64)->comment('组织代码');
            $table->string('user_id', 64)->comment('用户ID');
            $table->string('task_status', 32)->comment('任务状态');
            $table->string('usage_type', 32)->comment('使用类型(summary/item)');
            $table->integer('total_input_tokens')->nullable()->default(0)->comment('总输入token数');
            $table->integer('total_output_tokens')->nullable()->default(0)->comment('总输出token数');
            $table->integer('total_tokens')->nullable()->default(0)->comment('总token数');
            $table->string('model_id', 128)->nullable()->comment('模型ID');
            $table->string('model_name', 128)->nullable()->comment('模型名称');
            $table->integer('cached_tokens')->nullable()->default(0)->comment('缓存token数');
            $table->integer('cache_write_tokens')->nullable()->default(0)->comment('缓存写入token数');
            $table->integer('reasoning_tokens')->nullable()->default(0)->comment('推理token数');
            $table->json('usage_details')->nullable()->comment('完整的使用详情JSON');
            $table->timestamps();
            $table->softDeletes();

            // 索引设计
            $table->index(['task_id', 'topic_id'], 'idx_task_topic');
            $table->index(['organization_code', 'user_id', 'created_at'], 'idx_org_user_created');
            $table->index(['created_at'], 'idx_created_at');
            $table->index(['usage_type'], 'idx_usage_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_super_agent_token_usage_records');
    }
}; 