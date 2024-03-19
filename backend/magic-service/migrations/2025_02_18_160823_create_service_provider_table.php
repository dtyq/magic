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
        if (Schema::hasTable('service_provider')) {
            return;
        }

        Schema::create('service_provider', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name', 50)->comment('服务商名称');
            $table->string('provider_code', 50)->comment('服务商编码，表示属于哪个 AI 服务商。如：官方，DS，阿里云等');
            $table->string('description', 255)->nullable()->comment('服务商描述');
            $table->string('icon', 255)->nullable()->comment('服务商图标');
            $table->tinyInteger('provider_type')->default(0)->comment('服务商类型：0-普通，1-官方');
            $table->string('category', 20)->comment('分类：llm-大模型，vlm-视觉模型');
            $table->tinyInteger('status')->default(0)->comment('状态：0-未启用，1-启用');
            $table->tinyInteger('is_models_enable')->default(0)->comment('模型列表获取：0-未启用，1-启用');
            $table->timestamps();
            $table->softDeletes();
            $table->index('category', 'idx_category');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('service_provider');
    }
};
