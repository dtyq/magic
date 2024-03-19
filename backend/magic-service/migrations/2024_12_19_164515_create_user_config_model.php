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
        Schema::create('magic_api_user_configs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('user_id', 64)->default('')->comment('用户id');
            $table->string('organization_code', 64)->default('')->comment('组织code');
            $table->string('app_code', 64)->default('')->comment('应用code');
            $table->unsignedDecimal('total_amount', 40, 6)->comment('总额度')->default(0);
            $table->unsignedDecimal('use_amount', 40, 6)->comment('使用额度')->default(0);
            $table->unsignedInteger('rpm')->comment('RPM限流')->default(0);
            $table->datetimes();
            $table->softDeletes();

            $table->index(['user_id', 'app_code', 'organization_code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_api_user_configs');
    }
};
