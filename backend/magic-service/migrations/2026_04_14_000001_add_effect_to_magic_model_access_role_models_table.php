<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Domain\Permission\Entity\ValueObject\ModelAccessRuleEffect;
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('magic_model_access_role_models')) {
            return;
        }

        Schema::table('magic_model_access_role_models', static function (Blueprint $table) {
            if (! Schema::hasColumn('magic_model_access_role_models', 'effect')) {
                $table->string('effect', 16)
                    ->default(ModelAccessRuleEffect::DENY->value)
                    ->after('model_id')
                    ->comment('规则效果: deny');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('magic_model_access_role_models')) {
            return;
        }

        Schema::table('magic_model_access_role_models', static function (Blueprint $table) {
            if (Schema::hasColumn('magic_model_access_role_models', 'effect')) {
                $table->dropColumn('effect');
            }
        });
    }
};
