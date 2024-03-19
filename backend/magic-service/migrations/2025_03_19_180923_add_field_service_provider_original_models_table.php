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
        Schema::table('service_provider_original_models', function (Blueprint $table) {
            // 添加类型，系统默认的，自己添加的
            $table->tinyInteger('type')->default(0)->comment('类型，0：系统默认，1：自己添加');
            // 组织编码
            $table->string('organization_code')->default('')->comment('组织编码');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_provider_original_models', function (Blueprint $table) {
            $table->dropColumn('type');
            $table->dropColumn('organization_code');
        });
    }
};
