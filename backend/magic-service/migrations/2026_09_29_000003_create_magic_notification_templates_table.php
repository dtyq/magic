<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('magic_notification_templates', function (Blueprint $table): void {
            $table->unsignedBigInteger('id')->primary()->comment('模板记录 ID');
            $table->string('template_type', 64)->comment('模板类型');
            $table->unsignedInteger('version')->comment('模板版本');
            $table->string('locale', 16)->comment('语言');
            $table->text('title_template')->comment('标题模板');
            $table->text('body_template')->comment('正文模板');
            $table->string('status', 32)->default('active')->comment('模板状态');
            $table->dateTime('created_at')->comment('创建时间');
            $table->dateTime('updated_at')->comment('更新时间');

            $table->unique(['template_type', 'version', 'locale'], 'uniq_notification_template_locale');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_notification_templates');
    }
};
