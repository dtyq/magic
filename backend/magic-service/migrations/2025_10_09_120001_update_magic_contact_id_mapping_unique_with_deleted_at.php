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
        Schema::table('magic_contact_third_platform_id_mapping', static function (Blueprint $table) {
            // 调整唯一索引以包含 deleted_at，避免软删除记录造成的唯一约束冲突
            $table->dropIndex('unique_env_origin_mapping_type_third_type_org_code');
            $table->unique(
                ['magic_environment_id', 'origin_id', 'mapping_type', 'third_platform_type', 'magic_organization_code', 'deleted_at'],
                'unique_env_origin_mapping_type_third_type_org_code'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_contact_third_platform_id_mapping', static function (Blueprint $table) {
            // 还原为未包含 deleted_at 的唯一索引
            $table->dropIndex('unique_env_origin_mapping_type_third_type_org_code');
            $table->unique(
                ['magic_environment_id', 'origin_id', 'mapping_type', 'third_platform_type', 'magic_organization_code'],
                'unique_env_origin_mapping_type_third_type_org_code'
            );
        });
    }
};


