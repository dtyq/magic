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
        if (Schema::hasTable('magic_slides_template_favorites')) {
            return;
        }

        Schema::create('magic_slides_template_favorites', static function (Blueprint $table): void {
            $table->bigIncrements('id')->comment('主键 ID');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->string('user_id', 64)->comment('用户 ID');
            $table->string('slide_template_code', 64)->comment('幻灯片模板编码');
            $table->timestamps();

            $table->unique(
                ['organization_code', 'user_id', 'slide_template_code'],
                'uk_org_user_slide_template_code'
            );
            $table->index(['organization_code', 'user_id', 'created_at'], 'idx_org_user_created');
            $table->index(['slide_template_code'], 'idx_slide_template_code');
        });
    }

    public function down(): void
    {
    }
};
