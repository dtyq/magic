<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

class CreateMagicApiModelConfigTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('magic_api_model_configs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('model')->comment('模型');
            $table->unsignedDecimal('total_amount', 40, 6)->comment('总额度');
            $table->unsignedDecimal('use_amount', 40, 6)->comment('使用额度')->default(0);
            $table->integer('rpm')->comment('限流');
            $table->unsignedDecimal('exchange_rate')->comment('汇率');
            $table->unsignedDecimal('input_cost_per_1000', 40, 6)->comment('1000 token 輸入費用');
            $table->unsignedDecimal('output_cost_per_1000', 40, 6)->comment('1000 token 輸出費用');
            $table->timestamp('created_at')->default(Db::raw('CURRENT_TIMESTAMP'))->comment('创建时间');
            $table->timestamp('updated_at')->default(Db::raw('CURRENT_TIMESTAMP'))->comment('修改时间')->nullable();
            $table->timestamp('deleted_at')->comment('逻辑删除')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_api_model_config');
    }
}
