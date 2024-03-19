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
        if (Schema::hasTable('service_provider_models')) {
            return;
        }

        Schema::create('service_provider_models', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('service_provider_config_id')->index()->comment('服务商ID');
            $table->string('name', 50)->comment('模型名称');
            $table->string('model_version', 50)->comment('模型在服务商下的名称');
            $table->string('model_id', 50)->comment('模型真实ID');
            $table->string('category')->comment('模型分类：llm/vlm');
            $table->tinyInteger('model_type')->comment('具体类型,用于分组用');
            $table->json('config')->comment('模型的配置信息');
            $table->string('description', 255)->nullable()->comment('模型描述');
            $table->integer('sort')->default(0)->comment('排序');
            $table->string('icon')->default('')->comment('图标');
            $table->string('organization_code')->comment('组织编码');
            $table->tinyInteger('status')->default(0)->comment('状态：0-未启用，1-启用');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['organization_code', 'service_provider_config_id'], 'idx_organization_code_service_provider_config_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('service_provider_models');
    }
};
