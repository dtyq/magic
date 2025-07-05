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
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            if (Schema::hasColumn('magic_super_agent_message', 'mentions')) {
                return;
            }
            $table->json('mentions')->nullable()->after('attachments')->comment('提及信息');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('magic_super_agent_message', 'mentions')) {
            Schema::table('magic_super_agent_message', function (Blueprint $table) {
                $table->dropColumn('mentions');
            });
        }
    }
};
