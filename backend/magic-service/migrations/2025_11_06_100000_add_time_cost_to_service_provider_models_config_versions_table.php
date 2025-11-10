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
        Schema::table('service_provider_models_config_versions', function (Blueprint $table) {
            $table->decimal('time_cost', 10, 4)->nullable()->after('time_pricing')->comment('计费单价成本');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_provider_models_config_versions', function (Blueprint $table) {
        });
    }
};
