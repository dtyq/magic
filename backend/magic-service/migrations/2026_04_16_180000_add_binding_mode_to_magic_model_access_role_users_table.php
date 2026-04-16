<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Domain\Permission\Entity\ValueObject\ModelAccessRoleBindingMode;
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('magic_model_access_role_users')) {
            return;
        }

        Schema::table('magic_model_access_role_users', static function (Blueprint $table) {
            if (! Schema::hasColumn('magic_model_access_role_users', 'binding_mode')) {
                $table->unsignedTinyInteger('binding_mode')
                    ->default(ModelAccessRoleBindingMode::INCLUDE->value)
                    ->after('role_id')
                    ->comment('绑定模式: 1=包含,2=排除');
            }
        });

        Db::table('magic_model_access_role_users')
            ->whereNull('binding_mode')
            ->update([
                'binding_mode' => ModelAccessRoleBindingMode::INCLUDE->value,
            ]);

        Schema::table('magic_model_access_role_users', static function (Blueprint $table) {
            $table->index(['organization_code', 'role_id', 'binding_mode'], 'idx_org_role_binding_mode');
            $table->index(['organization_code', 'binding_mode', 'principal_type', 'principal_id'], 'idx_org_binding_principal');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('magic_model_access_role_users')) {
            return;
        }

        Schema::table('magic_model_access_role_users', static function (Blueprint $table) {
            if (Schema::hasColumn('magic_model_access_role_users', 'binding_mode')) {
                $table->dropIndex('idx_org_role_binding_mode');
                $table->dropIndex('idx_org_binding_principal');
                $table->dropColumn('binding_mode');
            }
        });
    }
};
