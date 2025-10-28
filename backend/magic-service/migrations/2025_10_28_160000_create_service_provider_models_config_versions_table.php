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
        if (Schema::hasTable('service_provider_models_config_versions')) {
            return;
        }

        Schema::create('service_provider_models_config_versions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('service_provider_model_id')->comment('模型ID，关联service_provider_models.id');

            $table->decimal('creativity', 3, 2)->default(0.5)->comment('创造力参数');
            $table->integer('max_tokens')->nullable()->comment('最大token数');
            $table->decimal('temperature', 3, 2)->nullable()->comment('温度参数');
            $table->integer('vector_size')->default(2048)->comment('向量维度');
            $table->string('billing_type', 50)->nullable()->comment('计费类型');
            $table->decimal('time_pricing', 10, 4)->nullable()->comment('时间定价');
            $table->decimal('input_pricing', 10, 4)->nullable()->comment('输入定价');
            $table->decimal('output_pricing', 10, 4)->nullable()->comment('输出定价');
            $table->string('billing_currency', 10)->nullable()->comment('计费货币');
            $table->boolean('support_function')->default(false)->comment('是否支持函数调用');
            $table->decimal('cache_hit_pricing', 10, 4)->nullable()->comment('缓存命中定价');
            $table->integer('max_output_tokens')->nullable()->comment('最大输出token数');
            $table->boolean('support_embedding')->default(false)->comment('是否支持嵌入');
            $table->boolean('support_deep_think')->default(false)->comment('是否支持深度思考');
            $table->decimal('cache_write_pricing', 10, 4)->nullable()->comment('缓存写入定价');
            $table->boolean('support_multi_modal')->default(false)->comment('是否支持多模态');
            $table->boolean('official_recommended')->default(false)->comment('是否官方推荐');
            $table->decimal('input_cost', 10, 4)->nullable()->comment('输入成本');
            $table->decimal('output_cost', 10, 4)->nullable()->comment('输出成本');
            $table->decimal('cache_hit_cost', 10, 4)->nullable()->comment('缓存命中成本');
            $table->decimal('cache_write_cost', 10, 4)->nullable()->comment('缓存写入成本');
            $table->integer('version')->default(1)->comment('版本号');
            $table->boolean('is_current_version')->default(true)->comment('是否当前版本：1-是，0-否');
            $table->timestamps();

            $table->index(['service_provider_model_id', 'is_current_version'], 'idx_model_id_is_current');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
