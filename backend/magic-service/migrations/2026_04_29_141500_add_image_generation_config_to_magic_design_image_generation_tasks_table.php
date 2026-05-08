<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddImageGenerationConfigToMagicDesignImageGenerationTasksTable extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('magic_design_image_generation_tasks', 'image_generation_config')) {
            return;
        }

        Schema::table('magic_design_image_generation_tasks', function (Blueprint $table) {
            $table->json('image_generation_config')->nullable()->after('reference_image_options')->comment('图片生成附加配置，如 quality 等模型特定参数');
        });
    }

    public function down(): void
    {
    }
}
