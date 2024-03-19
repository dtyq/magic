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
        Schema::create('admin_global_settings', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedInteger('type')->comment('类型');
            $table->unsignedTinyInteger('status')->default(0)->comment('状态');
            $table->json('extra')->nullable()->comment('额外配置');
            $table->string('organization')->comment('组织编码');
            $table->unique(['type', 'organization'], 'unique_type_organization');
            $table->datetimes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('admin_global_settings');
    }
};
