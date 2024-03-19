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
        if (Schema::hasTable('service_provider_configs')) {
            return;
        }

        Schema::create('service_provider_configs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('service_provider_id')->comment('服务商ID');
            $table->string('organization_code', 50)->comment('组织编码');
            $table->longText('config')->nullable()->comment('配置信息JSON');
            $table->tinyInteger('status')->default(0)->comment('状态：0-未启用，1-启用');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['organization_code', 'status'], 'index_service_provider_configs_organization_code_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('service_provider_configs');
    }
};
