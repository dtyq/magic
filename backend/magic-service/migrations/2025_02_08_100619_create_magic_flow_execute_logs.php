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
        Schema::dropIfExists('magic_flow_execute_logs');
        Schema::create('magic_flow_execute_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('execute_data_id')->default('')->comment('执行数据ID');
            $table->string('conversation_id')->default('')->comment('会话ID');
            $table->string('flow_code')->default('')->comment('流程编码');
            $table->string('flow_version_code')->default('')->comment('版本编码');
            $table->integer('status')->default(0)->comment('状态 1 准备运行;2 运行中;3 完成;4 失败;5 取消')->index();
            $table->json('ext_params')->nullable()->comment('扩展参数');
            $table->json('result')->nullable()->comment('结果');
            $table->timestamp('created_at')->nullable()->comment('创建时间');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_flow_execute_logs');
    }
};
