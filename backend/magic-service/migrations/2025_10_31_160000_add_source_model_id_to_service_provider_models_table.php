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
            $table->unsignedBigInteger('source_model_id')
                ->nullable()
                ->after('service_provider_config_id')
                ->comment('同步源模型ID，用于Official服务商同步其他服务商的模型时记录源模型ID');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_provider_models', function (Blueprint $table) {
            $table->dropColumn('source_model_id');
        });
    }
};
