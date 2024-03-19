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
        if (Schema::hasTable('magic_skill_categories')) {
            return;
        }
        Schema::create('magic_skill_categories', static function (Blueprint $table) {
            $table->bigIncrements('id')->comment('主键 ID');
            $table->json('name_i18n')->nullable()->comment('多语言名称，格式：{"en":"xxx","zh":"xxx"}，必须包含 en');
            $table->integer('sort_order')->default(0)->comment('排序权重，数值越大越靠前');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
