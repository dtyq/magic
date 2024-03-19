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
        Schema::table('magic_api_model_configs', function (Blueprint $table) {
            $table->string('type', 80)->default('')->comment('模型类型')->after('model');
            // 给 model 增加注释：实际上代表 endpoint
            $table->string('model')->comment('实际上代表 endpoint')->change();
            $table->index('type', 'idx_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_api_model_configs', function (Blueprint $table) {
            $table->dropIndex('idx_type');
            $table->dropColumn('type');
            $table->string('model')->comment('模型名称')->change();
        });
    }
};
