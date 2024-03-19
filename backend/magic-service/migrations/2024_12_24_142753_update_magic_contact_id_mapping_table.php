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
            // magic_environment_id
            $table->bigInteger('magic_environment_id')->default(0)->comment('magic_environments 表 id')->after('magic_organization_code');
            $table->dropIndex('unique_origin_id_mapping_type');
            $table->dropIndex('new_id_mapping_type');
            $table->index(['new_id', 'mapping_type', 'magic_organization_code'], 'idx_new_id_mapping_type_org_code');
            $table->unique(
                ['magic_environment_id', 'origin_id', 'mapping_type', 'third_platform_type', 'magic_organization_code'],
                'unique_env_origin_mapping_type_third_type_org_code'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
