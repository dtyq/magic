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
        Schema::table('service_provider_models', function (Blueprint $table) {
            $table->string('type', 32)->default('ATOM')->comment('模型类型：ATOM(普通模型) / DYNAMIC(动态模型)');
            $table->json('aggregate_config')->nullable()->comment('动态模型配置（仅当type=DYNAMIC时使用）');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_provider_models', function (Blueprint $table) {
            $table->dropColumn(['type', 'aggregate_config']);
        });
    }
};
