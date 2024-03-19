<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('service_provider', function (Blueprint $table) {
            $table->json('translate')->default(Db::raw('(JSON_ARRAY())'))->comment('多语言配置，格式：{"": "名称", "en_US": "name"}');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_provider', function (Blueprint $table) {
            $table->dropColumn('translate');
        });
    }
};
