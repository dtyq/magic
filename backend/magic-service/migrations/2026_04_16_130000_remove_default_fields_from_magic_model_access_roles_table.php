<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('magic_model_access_roles')) {
            return;
        }

        Db::transaction(function () {
            if (Schema::hasTable('magic_model_access_role_users')
                && Schema::hasColumn('magic_model_access_roles', 'is_default')
            ) {
                $defaultRoles = Db::table('magic_model_access_roles')
                    ->select(['id', 'organization_code'])
                    ->where('is_default', 1)
                    ->whereNull('deleted_at')
                    ->get();

                $now = date('Y-m-d H:i:s');
                foreach ($defaultRoles as $defaultRole) {
                    $defaultRole = (array) $defaultRole;

                    $exists = Db::table('magic_model_access_role_users')
                        ->where('organization_code', $defaultRole['organization_code'])
                        ->where('role_id', $defaultRole['id'])
                        ->where('principal_type', 3)
                        ->where('principal_id', $defaultRole['organization_code'])
                        ->exists();

                    if ($exists) {
                        continue;
                    }

                    Db::table('magic_model_access_role_users')->insert([
                        'organization_code' => $defaultRole['organization_code'],
                        'role_id' => $defaultRole['id'],
                        'principal_type' => 3,
                        'principal_id' => $defaultRole['organization_code'],
                        'user_id' => '',
                        'assigned_by' => 'migration',
                        'assigned_at' => $now,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            if (Schema::hasColumn('magic_model_access_roles', 'is_default')) {
                Db::table('magic_model_access_roles')->update(['is_default' => 0]);
            }

            if (Schema::hasColumn('magic_model_access_roles', 'parent_role_id')) {
                Db::table('magic_model_access_roles')->update(['parent_role_id' => null]);
            }
        });

        Schema::table('magic_model_access_roles', static function (Blueprint $table) {
            if (Schema::hasColumn('magic_model_access_roles', 'is_default')) {
                $table->dropIndex('idx_org_default');
                $table->dropColumn('is_default');
            }

            if (Schema::hasColumn('magic_model_access_roles', 'parent_role_id')) {
                $table->dropIndex('idx_org_parent_role_id');
                $table->dropColumn('parent_role_id');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('magic_model_access_roles')) {
            return;
        }

        Schema::table('magic_model_access_roles', static function (Blueprint $table) {
            if (! Schema::hasColumn('magic_model_access_roles', 'is_default')) {
                $table->tinyInteger('is_default')->default(0)->comment('是否默认角色: 0=否,1=是')->after('description');
                $table->index(['organization_code', 'is_default'], 'idx_org_default');
            }

            if (! Schema::hasColumn('magic_model_access_roles', 'parent_role_id')) {
                $table->unsignedBigInteger('parent_role_id')->nullable()->comment('父角色ID')->after('is_default');
                $table->index(['organization_code', 'parent_role_id'], 'idx_org_parent_role_id');
            }
        });
    }
};
