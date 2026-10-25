<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/* 保存模型版本的默认思考强度，历史记录不回填。 */
return new class extends Migration {
    /** 空值表示继续跟随服务商默认。 */
    public function up(): void
    {
        Schema::table('service_provider_models_config_versions', static function (Blueprint $table) {
            $table->string('reasoning_effort_default', 16)->nullable()->comment('默认思考强度，空值跟随服务商')->after('reasoning_effort_levels');
        });
    }

    /** 仅移除本次新增字段。 */
    public function down(): void
    {
        Schema::table('service_provider_models_config_versions', static function (Blueprint $table) {
            $table->dropColumn('reasoning_effort_default');
        });
    }
};
