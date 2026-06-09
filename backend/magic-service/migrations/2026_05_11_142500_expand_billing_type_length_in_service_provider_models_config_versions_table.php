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
            $table->string('billing_type', 200)->nullable()->comment('计费类型')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_provider_models_config_versions', function (Blueprint $table) {
            $table->string('billing_type', 50)->nullable()->comment('计费类型')->change();
        });
    }
};
