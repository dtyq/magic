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
        if (Schema::hasTable('magic_api_premium_endpoint_statistics')) {
            return;
        }

        Schema::create('magic_api_premium_endpoint_statistics', function (Blueprint $table) {
            $table->bigIncrements('id');
            // 这里可以实现对接入点请求的统计逻辑
            // 例如：记录请求次数、请求类型、资源消耗等
            $table->string('endpoint_id', 64)->nullable()->default(null)->comment('接入点id');
            $table->integer('request_count')->nullable()->default(null)->comment('请求次数');
            $table->integer('request_success_count')->nullable()->default(null)->comment('请求成功次数');
            $table->integer('request_error_count')->nullable()->default(null)->comment('请求失败次数');
            $table->double('request_success_rate')->nullable()->default(null)->comment('请求成功率,最大值为 100，不带%');
            $table->integer('request_average_time')->nullable()->default(null)->comment('请求平均时间，单位毫秒');
            $table->integer('request_max_time')->nullable()->default(null)->comment('请求消耗的最大时间，单位毫秒');
            $table->integer('request_min_time')->nullable()->default(null)->comment('请求消耗的最小时间，单位毫秒');
            // 统计时间段
            $table->bigInteger('statistics_time')->nullable()->default(null)->comment('统计时间段');
            // 统计级别：0-秒级，1-分钟级，2-小时级，3-天级
            $table->tinyInteger('statistics_level')->nullable()->default(null)->comment('统计级别：0-秒级，1-分钟级，2-小时级，3-天级');
            $table->datetimes();
            $table->unique(['endpoint_id', 'statistics_time', 'statistics_level'], 'unique_endpoint_id_statistics_level_time');
            $table->comment('接入点请求统计表');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_api_premium_endpoint_statistics');
    }
};
