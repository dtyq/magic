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
        Schema::create('magic_flow_multi_modal_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('message_id', 64)->default('')->comment('消息ID')->index();
            $table->tinyInteger('type')->default(0)->comment('多模态类型。1 图片');
            $table->string('model', 128)->default('')->comment('识别所使用的模型');
            $table->text('analysis_result')->comment('分析结果');
            $table->datetimes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_flow_multi_modal_logs');
    }
};
