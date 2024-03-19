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
        if (Schema::hasTable('admin_operation_logs')) {
            return;
        }

        Schema::create('admin_operation_logs', static function (Blueprint $table) {
            $table->bigIncrements('id')->comment('日志ID');

            // 用户和组织信息
            $table->string('organization_code', 64)->nullable()->comment('组织编码');
            $table->string('user_id', 64)->nullable()->comment('操作人用户ID');
            $table->string('user_name', 255)->nullable()->comment('操作人姓名');

            // 资源和操作信息
            $table->string('resource_code', 100)->nullable()->comment('资源代码');
            $table->string('resource_label', 200)->nullable()->comment('资源名称');
            $table->string('operation_code', 50)->nullable()->comment('操作代码');
            $table->string('operation_label', 100)->nullable()->comment('操作名称');
            $table->text('operation_description')->nullable()->comment('操作详细描述');

            // 客户端信息
            $table->string('ip', 45)->nullable()->comment('操作IP');

            // 时间戳
            $table->timestamps();

            $table->comment('管理员操作日志表');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('admin_operation_logs');
    }
};
