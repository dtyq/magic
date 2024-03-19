<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddProviderCodeToServiceProviderConfigsTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('service_provider_configs', function (Blueprint $table) {
            $table->string('provider_code', 64)->nullable()->after('service_provider_id')->comment('服务商编码');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_provider_configs', function (Blueprint $table) {
            $table->dropColumn('provider_code');
        });
    }
}
