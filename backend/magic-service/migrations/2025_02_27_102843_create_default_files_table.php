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
        Schema::create('default_files', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('business_type')->comment('模块类型,文件属于哪个模块');
            $table->integer('file_type')->comment('文件类型：0:官方添加，1:组织添加');
            $table->string('key')->comment('文件key');
            $table->bigInteger('file_size')->comment('文件大小');
            $table->string('organization')->index()->comment('组织编码');
            $table->string('file_extension')->index()->comment('文件后缀');
            $table->string('user_id')->comment('上传者');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('default_files');
    }
};
