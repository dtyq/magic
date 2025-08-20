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
        // 修改 service_provider 表的 name 字段长度
        Schema::table('service_provider', function (Blueprint $table) {
            $table->string('name', 255)->comment('服务商名称')->change();
        });

        // 修改 service_provider_models 表的相关字段长度
        Schema::table('service_provider_models', function (Blueprint $table) {
            $table->string('name', 255)->comment('模型名称')->change();
            $table->string('model_version', 255)->comment('模型在服务商下的名称')->change();
            $table->string('model_id', 255)->comment('模型真实ID')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // 回滚 service_provider 表的 name 字段长度
        Schema::table('service_provider', function (Blueprint $table) {
            $table->string('name', 50)->comment('服务商名称')->change();
        });

        // 回滚 service_provider_models 表的相关字段长度
        Schema::table('service_provider_models', function (Blueprint $table) {
            $table->string('name', 50)->comment('模型名称')->change();
            $table->string('model_version', 50)->comment('模型在服务商下的名称')->change();
            $table->string('model_id', 50)->comment('模型真实ID')->change();
        });
    }
};
