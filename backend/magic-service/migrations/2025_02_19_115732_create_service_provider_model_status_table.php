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
        if (Schema::hasTable('service_provider_model_status')) {
            return;
        }
        Schema::create('service_provider_model_status', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('model_id')->comment('模型id');
            $table->string('model_version')->comment('模型名称');
            $table->string('organization_code')->comment('组织编码');
            $table->bigInteger('service_provider_config_id')->comment('对应的服务商id');
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
        Schema::dropIfExists('service_provider_model_status');
    }
};
