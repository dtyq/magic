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
            $table->string('model', 80)->default('')->comment('模型')->index()->change();
            $table->string('name', 80)->default('')->comment('自定义名称');
            $table->boolean('enabled')->default(1)->comment('是否启用');
            $table->string('implementation', 100)->default('')->comment('实现类');
            $table->text('implementation_config')->nullable()->comment('实现类配置');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('', function (Blueprint $table) {
        });
    }
};
