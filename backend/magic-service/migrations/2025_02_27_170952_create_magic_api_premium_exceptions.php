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
        if (Schema::hasTable('magic_api_premium_exceptions')) {
            return;
        }

        Schema::create('magic_api_premium_exceptions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('exception_type', 255)->comment('异常类型');
            $table->boolean('can_retry')->comment('是否可以重试')->nullable();
            $table->integer('retry_max_times')->comment('重试最大次数')->nullable();
            $table->integer('retry_interval')->comment('重试时间间隔')->nullable();
            $table->datetimes();
            $table->comment('异常信息表，储存异常类型，是否可以重试，重试最大次数，重试时间间隔');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_api_premium_exceptions');
    }
};
