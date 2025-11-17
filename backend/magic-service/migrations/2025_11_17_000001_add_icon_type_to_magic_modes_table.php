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
        Schema::table('magic_modes', function (Blueprint $table) {
            $table->tinyInteger('icon_type')->default(1)->comment('图标类型 1:图标 2:图片')->after('icon');
            $table->string('icon_url', 512)->default('')->comment('图标图片URL')->after('icon_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_modes', function (Blueprint $table) {
        });
    }
};
