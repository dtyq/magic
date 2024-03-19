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
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Db::table('magic_api_access_tokens')->orderBy('id')->chunk(100, function ($tokens) {
            foreach ($tokens as $token) {
                if (! empty($token['encrypted_access_token'])) {
                    continue;
                }
                $encryptedToken = hash('sha256', $token['access_token']);
                Db::table('magic_api_access_tokens')
                    ->where('id', $token['id'])
                    ->update(['encrypted_access_token' => $encryptedToken]);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('', function (Blueprint $table) {
        });
    }
};
