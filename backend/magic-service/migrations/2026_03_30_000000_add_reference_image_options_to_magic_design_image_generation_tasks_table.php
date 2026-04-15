<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddReferenceImageOptionsToMagicDesignImageGenerationTasksTable extends Migration
{
    public function up(): void
    {
        Schema::table('magic_design_image_generation_tasks', function (Blueprint $table) {
            $table->json('reference_image_options')->nullable()->after('reference_images')->comment('参考图处理选项，key 为参考图索引，value 为图片处理参数（如 crop）');
        });
    }

    public function down(): void
    {
        Schema::table('magic_design_image_generation_tasks', function (Blueprint $table) {
            $table->dropColumn('reference_image_options');
        });
    }
}
