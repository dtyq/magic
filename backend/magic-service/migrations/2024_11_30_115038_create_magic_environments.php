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
        Schema::create('magic_environments', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('deployment', '32')->comment('部署类型.官方：saas|southeastAsia,私有：private');
            $table->string('environment', '32')->comment('环境类型：test/production');
            $table->json('config')->comment('环境配置详情');
            $table->timestamps();
            $table->unique(['deployment', 'environment'], 'unq_deployment_environment');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_environments');
    }
};
