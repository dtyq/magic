<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddResolutionToMagicDesignImageGenerationTasksTable extends Migration
{
    public function up(): void
    {
        Schema::table('magic_design_image_generation_tasks', function (Blueprint $table) {
            // 添加 resolution 字段，用于设置分辨率预设
            $table->string('resolution', 50)->nullable()->after('size')->comment('分辨率预设');
        });
    }

    public function down(): void
    {
    }
}
