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
        Schema::table('magic_environments', function (Blueprint $table) {
            // environment_code
            $table->string('environment_code', 64)->comment('环境 code')->default('');
            $table->string('third_platform_type', 64)->comment('第三方平台类型')->default('');
            // 索引,理论上唯一，但是业务需要，不通过 mysql 唯一索引来约束
            $table->index(['environment_code', 'third_platform_type'], 'idx_environment_code_third_platform_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
