<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/* 为模型配置版本保存思考档位，历史数据保持空值。 */
return new class extends Migration {
    /** 增加可空字段，不回填历史记录。 */
    public function up(): void
    {
        Schema::table('service_provider_models_config_versions', static function (Blueprint $table) {
            $table->json('reasoning_effort_levels')->nullable()->comment('允许用户选择的思考强度')->after('support_deep_think');
        });
    }

    /** 回滚本次增加的字段。 */
    public function down(): void
    {
        Schema::table('service_provider_models_config_versions', static function (Blueprint $table) {
            $table->dropColumn('reasoning_effort_levels');
        });
    }
};
