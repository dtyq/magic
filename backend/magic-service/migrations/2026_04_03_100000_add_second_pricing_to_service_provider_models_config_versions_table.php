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
            if (! Schema::hasColumn('service_provider_models_config_versions', 'second_pricing')) {
                $table->decimal('second_pricing', 10, 4)->nullable()->after('time_cost')->comment('按秒计价单价');
            }
            if (! Schema::hasColumn('service_provider_models_config_versions', 'second_cost')) {
                $table->decimal('second_cost', 10, 4)->nullable()->after('second_pricing')->comment('按秒计价成本');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_provider_models_config_versions', function (Blueprint $table) {
            $dropColumns = [];
            if (Schema::hasColumn('service_provider_models_config_versions', 'second_pricing')) {
                $dropColumns[] = 'second_pricing';
            }
            if (Schema::hasColumn('service_provider_models_config_versions', 'second_cost')) {
                $dropColumns[] = 'second_cost';
            }
            if ($dropColumns !== []) {
                $table->dropColumn($dropColumns);
            }
        });
    }
};
