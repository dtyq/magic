<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class CreateMagicFlowAIModels extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('magic_flow_ai_models', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code')->default('')->comment('组织代码');
            $table->string('name', 100)->default('')->comment('模型名称');
            $table->string('label', 100)->default('')->comment('显示');
            $table->string('model_name', 100)->default('')->comment('模型名称');
            $table->json('tags')->nullable()->comment('标签');
            $table->json('default_configs')->nullable()->comment('模型默认配置');
            $table->boolean('enabled')->default(1)->comment('是否启用');
            $table->string('implementation', 100)->default('')->comment('实现类');
            $table->text('implementation_config')->nullable()->comment('实现类配置');
            $table->boolean('support_embedding')->default(false)->comment('是否支持嵌入');
            $table->bigInteger('vector_size')->default(0)->comment('向量大小');

            $table->string('created_uid')->default('')->comment('创建者用户ID');
            $table->timestamp('created_at')->nullable()->comment('创建时间');
            $table->string('updated_uid')->default('')->comment('更新者用户ID');
            $table->timestamp('updated_at')->nullable()->comment('更新时间');
            $table->timestamp('deleted_at')->nullable()->comment('删除时间');

            $table->index('name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_flow_ai_models');
    }
}
