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
        Schema::table('service_provider', function (Blueprint $table) {
            if (! Schema::hasColumn('service_provider', 'sort_order')) {
                $table->integer('sort_order')->default(0)->comment('排序字段，数值越小越靠前')->after('is_models_enable');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_provider', function (Blueprint $table) {
            if (Schema::hasColumn('service_provider', 'sort_order')) {
                $table->dropColumn('sort_order');
            }
        });
    }
};
