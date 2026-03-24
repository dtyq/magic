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
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_super_agent_topics', 'agent_image')) {
                $table->string('agent_image', 512)
                    ->nullable()
                    ->default(null)
                    ->comment('Agent image used by sandbox (returned by sandbox gateway on create/upgrade)')
                    ->after('sandbox_config');
            }
        });
    }

    public function down(): void
    {
    }
};
