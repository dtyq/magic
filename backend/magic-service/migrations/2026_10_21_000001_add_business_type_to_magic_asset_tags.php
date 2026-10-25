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
        if (! Schema::hasTable('magic_asset_tags') || Schema::hasColumn('magic_asset_tags', 'business_type')) {
            return;
        }
        // 与 magic_assets.asset_business_type 对齐：标签只在所属业务类型的素材上使用，
        // 已有标签全部归入通用类型 GENERAL。
        Schema::table('magic_asset_tags', static function (Blueprint $table): void {
            $table->string('business_type', 64)->default('GENERAL')->after('organization_code')->comment('业务类型，与素材的业务类型一致');
            $table->index(['organization_code', 'business_type', 'status'], 'idx_asset_tag_business_type');
        });
    }

    public function down(): void
    {
    }
};
