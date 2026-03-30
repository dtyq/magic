<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddTypeToMagicDesignImageGenerationTasksTable extends Migration
{
    public function up(): void
    {
        Schema::table('magic_design_image_generation_tasks', function (Blueprint $table) {
            // 添加 type 字段，用于标识图片生成类型：1-文生图，2-图生图，3-转高清
            $table->tinyInteger('type')->default(0)->after('model_id')->comment('图片生成类型：1-文生图，2-图生图，3-转高清');
        });
    }

    public function down(): void
    {
    }
}
