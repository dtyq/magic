<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Service;

use App\Domain\Contact\Entity\ValueObject\AccountStatus;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use Hyperf\DbConnection\Db;

/**
 * 账号禁用及凭证撤销领域服务。
 *
 * 禁用账号时同时清理账号级、用户级及模型网关凭证，并停用关联 API Key。
 * 组织成员关系和成员状态不在这里修改，避免覆盖通讯录同步结果。
 */
class MagicAccountRevocationService
{
    /** @var int[] */
    private const array USER_TOKEN_TYPES = [
        MagicTokenType::User->value,
        MagicTokenType::PersonalAccessToken->value,
        MagicTokenType::RefreshToken->value,
        MagicTokenType::ModelGatewayUser->value,
    ];

    public function __construct(
        private readonly MagicAccountStatusService $statusService,
    ) {
    }

    /**
     * 禁用账号并撤销该账号下的本地凭证。
     *
     * @return array{
     *     magic_id: string,
     *     already_disabled: bool,
     *     user_count: int,
     *     account_tokens: int,
     *     user_tokens: int,
     *     refresh_tokens: int,
     *     model_gateway_tokens: int,
     *     api_keys: int
     * }
     */
    public function revoke(string $magicId): array
    {
        return Db::transaction(function () use ($magicId): array {
            $changed = $this->statusService->updateStatus($magicId, AccountStatus::Disable);

            $userIds = Db::table('magic_contact_users')
                ->where('magic_id', $magicId)
                ->whereNull('deleted_at')
                ->pluck('user_id')
                ->filter(static fn (mixed $userId): bool => (string) $userId !== '')
                ->map(static fn (mixed $userId): string => (string) $userId)
                ->unique()
                ->values()
                ->all();

            $accountTokens = Db::table('magic_tokens')
                ->where('type', MagicTokenType::Account->value)
                ->where('type_relation_value', $magicId);
            $accountTokenCount = (int) $accountTokens->count();
            if ($accountTokenCount > 0) {
                $accountTokens->delete();
            }

            $userTokenCount = 0;
            $refreshTokenCount = 0;
            $modelGatewayTokenCount = 0;
            if ($userIds !== []) {
                $userTokens = Db::table('magic_tokens')
                    ->whereIn('type', self::USER_TOKEN_TYPES)
                    ->whereIn('type_relation_value', $userIds);
                $userTokenCount = (int) $userTokens->count();
                $refreshTokenCount = (int) (clone $userTokens)
                    ->where('type', MagicTokenType::RefreshToken->value)
                    ->count();
                $modelGatewayTokenCount = (int) (clone $userTokens)
                    ->where('type', MagicTokenType::ModelGatewayUser->value)
                    ->count();
                if ($userTokenCount > 0) {
                    $userTokens->delete();
                }
            }

            $apiKeyCount = 0;
            if ($userIds !== []) {
                $apiKeys = Db::table('magic_api_access_tokens')
                    ->whereIn('user_id', $userIds)
                    ->where('enabled', 1)
                    ->whereNull('deleted_at');
                $apiKeyCount = (int) $apiKeys->count();
                if ($apiKeyCount > 0) {
                    $apiKeys->update([
                        'enabled' => 0,
                        'updated_at' => date('Y-m-d H:i:s'),
                    ]);
                }
            }

            return [
                'magic_id' => $magicId,
                'already_disabled' => ! $changed,
                'user_count' => count($userIds),
                'account_tokens' => $accountTokenCount,
                'user_tokens' => $userTokenCount,
                'refresh_tokens' => $refreshTokenCount,
                'model_gateway_tokens' => $modelGatewayTokenCount,
                'api_keys' => $apiKeyCount,
            ];
        });
    }
}
