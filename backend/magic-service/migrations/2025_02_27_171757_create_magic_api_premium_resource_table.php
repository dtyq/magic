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
        // 表存在就不执行
        if (Schema::hasTable('magic_api_premium_resources')) {
            return;
        }
        Schema::create('magic_api_premium_resources', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('endpoint_id', 64)->comment('接入点ID');
            $table->string('resource_name', 64)->comment('资源名称');
            $table->integer('billing_cycle_value')->default(0)->comment('计费周期值');
            $table->tinyInteger('billing_cycle_type')->default(0)->comment('0: 总量, 1：秒, 2：分钟, 3：小时, 4：天');
            $table->integer('total_usage')->default(0)->comment('总量');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['endpoint_id', 'id'], 'index_endpoint_id');
            $table->comment('API资源计费规则表，支持总量或者速率计费');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_api_premium_resources');
    }
};
