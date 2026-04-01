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
        Schema::table('magic_applications', function (Blueprint $table) {
            $table->string('icon_url', 2048)->default('')->comment('应用图标图片地址（完整 URL）')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_applications', function (Blueprint $table) {
            $table->string('icon_url', 255)->default('')->comment('应用图标图片地址')->change();
        });
    }
};
