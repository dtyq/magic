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
        Schema::table('admin_operation_logs', static function (Blueprint $table) {
            // 在 ip 字段之后添加新字段
            $table->string('request_url', 500)->nullable()->comment('请求URL（包含方法和完整路径）')->after('ip');
            $table->text('request_body')->nullable()->comment('请求体内容（JSON格式）')->after('request_url');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('admin_operation_logs', static function (Blueprint $table) {
            $table->dropColumn(['request_url', 'request_body']);
        });
    }
};
