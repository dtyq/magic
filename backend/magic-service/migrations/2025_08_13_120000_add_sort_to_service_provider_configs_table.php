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
        Schema::table('service_provider_configs', function (Blueprint $table) {
            if (! Schema::hasColumn('service_provider_configs', 'sort')) {
                $table->integer('sort')->default(0)->comment('排序字段，数值越大越靠前')->after('translate');
            }
        });
    }
};
