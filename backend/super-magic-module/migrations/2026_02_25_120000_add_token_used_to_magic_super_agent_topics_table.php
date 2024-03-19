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
            if (! Schema::hasColumn('magic_super_agent_topics', 'token_used')) {
                $table->unsignedBigInteger('token_used')
                    ->nullable()
                    ->comment('Current task token usage snapshot')
                    ->after('cost');
            }
        });
    }

    public function down(): void
    {
    }
};
