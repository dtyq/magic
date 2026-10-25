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
     * 增加模型部署版本字段。
     */
    public function up(): void
    {
        if (Schema::hasColumn('magic_api_msg_logs', 'model_version')) {
            return;
        }

        Schema::table('magic_api_msg_logs', function (Blueprint $table) {
            $table->string('model_version', 255)->default('')->comment('服务商模型部署版本')->after('model');
        });
    }

    /**
     * 回滚模型部署版本字段。
     */
    public function down(): void
    {
        if (! Schema::hasColumn('magic_api_msg_logs', 'model_version')) {
            return;
        }

        Schema::table('magic_api_msg_logs', function (Blueprint $table) {
            $table->dropColumn('model_version');
        });
    }
};
