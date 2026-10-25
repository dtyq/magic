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
        if (Schema::hasTable('magic_api_image_generation_tasks')) {
            return;
        }

        Schema::create('magic_api_image_generation_tasks', function (Blueprint $table) {
            $table->string('id', 64)->primary()->comment('图片生成任务ID');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->string('user_id', 64)->comment('用户ID');
            $table->string('access_token_id', 64)->comment('模型网关 access token ID');
            $table->string('environment', 64)->default('')->comment('环境');
            $table->string('model', 128)->comment('请求模型');
            $table->json('request_payload')->comment('请求快照');
            $table->json('response_payload')->nullable()->comment('OpenAI 图片响应快照');
            $table->string('status', 32)->comment('任务状态');
            $table->string('error_code', 64)->nullable()->comment('错误码');
            $table->text('error_message')->nullable()->comment('错误信息');
            $table->timestamp('started_at')->nullable()->comment('开始时间');
            $table->timestamp('finished_at')->nullable()->comment('结束时间');
            $table->timestamps();

            $table->index(['environment', 'organization_code', 'user_id', 'status'], 'idx_env_org_user_status');
            $table->index(['environment', 'status', 'created_at'], 'idx_env_status_created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_api_image_generation_tasks');
    }
};
