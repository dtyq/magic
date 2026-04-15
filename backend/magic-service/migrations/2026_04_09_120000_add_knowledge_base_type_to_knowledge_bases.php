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
        Schema::table('magic_flow_knowledge', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_flow_knowledge', 'knowledge_base_type')) {
                $table->string('knowledge_base_type', 64)->default('flow_vector')->comment('知识库产品线');
            }
        });

        if (! Schema::hasTable('knowledge_base_bindings')) {
            return;
        }

        Db::table('magic_flow_knowledge')
            ->whereIn('code', function ($query) {
                $query->select('knowledge_base_code')
                    ->from('knowledge_base_bindings')
                    ->where('bind_type', 'super_magic_agent');
            })
            ->update([
                'knowledge_base_type' => 'digital_employee',
            ]);
    }

    public function down(): void
    {
        Schema::table('magic_flow_knowledge', function (Blueprint $table) {
            if (Schema::hasColumn('magic_flow_knowledge', 'knowledge_base_type')) {
                $table->dropColumn('knowledge_base_type');
            }
        });
    }
};
