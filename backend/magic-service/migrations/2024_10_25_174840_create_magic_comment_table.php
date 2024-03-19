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
        if (Schema::hasTable('magic_comments')) {
            return;
        }
        Schema::create('magic_comments', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->tinyInteger('type')->comment('类型，例如评论、动态');
            $table->json('attachments')->comment('附件');
            $table->string('description')->comment('对评论的简短描述，主要是给动态用的，例如创建待办、上传图片等系统动态');
            $table->unsignedBigInteger('resource_id')->index()->comment('评论的资源id，例如云文档id、sheet表id');
            $table->tinyInteger('resource_type')->comment('评论的资源类型，例如云文档、sheet表');
            $table->unsignedBigInteger('parent_id')->index()->comment('父级评论的主键id');
            $table->text('message')->comment('评论的内容');
            $table->string('creator')->index()->comment('创建人');
            $table->string('organization_code')->index()->comment('组织code');
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('comment');
    }
};
