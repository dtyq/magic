<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('service_provider_models', 'extra')) {
            Schema::table('service_provider_models', function (Blueprint $table) {
                $table->text('extra')->nullable()->after('aggregate_config')->comment('扩展信息');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('service_provider_models', 'extra')) {
            Schema::table('service_provider_models', function (Blueprint $table) {
                $table->dropColumn('extra');
            });
        }
    }
};
