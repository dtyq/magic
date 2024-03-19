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
        if (Schema::hasTable('magic_ai_abilities')) {
            return;
        }

        Schema::create('magic_ai_abilities', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('code', 50)->comment('能力唯一标识');
            $table->string('organization_code', 100)->default('')->comment('组织编码');
            $table->json('name_i18n')->comment('能力名称（多语言JSON格式）');
            $table->json('description_i18n')->comment('能力描述（多语言JSON格式）');
            $table->string('icon', 100)->nullable()->comment('图标标识');
            $table->integer('sort_order')->default(0)->comment('排序');
            $table->tinyInteger('status')->default(1)->comment('状态：0-禁用，1-启用');
            $table->json('config')->comment('配置信息（provider_code, access_point, api_key, model_id等）');
            $table->timestamps();

            $table->index('code', 'idx_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_ai_abilities');
    }
};
