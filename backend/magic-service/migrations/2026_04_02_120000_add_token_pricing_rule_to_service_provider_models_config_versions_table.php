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
        if (Schema::hasColumn('service_provider_models_config_versions', 'billing_tiers')) {
            return;
        }

        Schema::table('service_provider_models_config_versions', function (Blueprint $table) {
            if (! Schema::hasColumn('service_provider_models_config_versions', 'billing_tiers')) {
                $table->json('billing_tiers')->nullable()->after('time_cost')->comment('计费阶梯');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasColumn('service_provider_models_config_versions', 'billing_tiers')) {
            return;
        }

        Schema::table('service_provider_models_config_versions', function (Blueprint $table) {
            if (Schema::hasColumn('service_provider_models_config_versions', 'billing_tiers')) {
                $table->dropColumn('billing_tiers');
            }
        });
    }
};
