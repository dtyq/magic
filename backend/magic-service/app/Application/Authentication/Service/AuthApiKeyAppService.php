<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Authentication\Service;

use App\Application\Authentication\DTO\ApiKeyAuthResult;
use App\Application\Authentication\DTO\MagicUserTokenResolveResult;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Service\AccessTokenDomainService;
use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Entity\ValueObject\ModelGatewayTokenKey;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\ErrorCode\HttpErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\RequestUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use DateTime;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class AuthApiKeyAppService extends AuthBaseAppService
{
    /**
     * 模型网关鉴权策略（本类职责）：
     * - 同时兼容历史 AccessToken 与新链路 ModelGatewayUser；
     * - 兼容 MagicTokenType::User（沙箱存量令牌）；
     * - 冲突时遵循既定优先级 user-authorization > api-key，并输出审计日志。
     */
    private LoggerInterface $logger;

    public function __construct(
        private readonly AccessTokenDomainService $accessTokenDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly MagicTokenRepositoryInterface $magicTokenRepository,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 尽量保持历史语义：
     * 1) 有 user-authorization 时优先按 ModelGatewayUser（mgw_ 前缀）校验，再兼容 User；
     * 2) 若失败且有 api-key，再回退尝试 api-key（含历史 AccessToken + User）；
     * 3) 无 user-authorization 时走 api-key 路径。
     *
     * @param array<string,mixed> $headers
     * @param array<string,mixed> $serverParams
     */
    public function authenticate(array $headers, array $serverParams = []): ApiKeyAuthResult
    {
        // 先提取两类鉴权头，后续按固定优先级处理：user-authorization > api-key。
        $userAuthorizationHeader = $this->getUserAuthorizationFromHeaders($headers);
        $apiKey = $this->getApiKeyFromHeaders($headers);

        // 若携带 user-authorization，只按“用户令牌链路”鉴权；
        // 命中后直接返回，不再继续读取 api-key 做二次鉴权（仅记录冲突审计日志）。
        $userAuthorizationResult = $this->authenticateByUserAuthorization($userAuthorizationHeader, $headers, $serverParams);
        if ($userAuthorizationResult instanceof ApiKeyAuthResult) {
            $this->auditConflict($userAuthorizationResult, $apiKey, $headers, $serverParams);
            return $userAuthorizationResult;
        }

        // user-authorization 缺失或校验失败时，才进入 api-key 路径；
        // api-key 路径内部会依次尝试：ModelGatewayUser(mgw_) -> AccessToken(历史) -> MagicUser token(兼容)。
        $apiKeyResult = $this->authenticateByApiKey($apiKey, $headers, $serverParams);
        if ($apiKeyResult instanceof ApiKeyAuthResult) {
            // 显式记录“user-authorization 失败后回退 api-key 成功”的审计事件，便于排查调用方问题。
            if ($userAuthorizationHeader !== '') {
                $this->auditAuthEvent(
                    'fallback_to_api_key',
                    $headers,
                    $serverParams,
                    'user-authorization',
                    'api-key',
                    $apiKeyResult->authTokenType,
                    $this->extractUserIdFromResult($apiKeyResult),
                    0
                );
            }
            return $apiKeyResult;
        }

        // 两条链路均失败：统一记审计并按 Unauthorized 拒绝请求。
        $headerSource = $this->detectHeaderSource($userAuthorizationHeader, $apiKey);
        $reason = $userAuthorizationHeader !== '' ? 'user-authorization failed and fallback failed' : 'all auth methods failed';
        $this->auditAuthFailed($headers, $serverParams, $headerSource, $reason);
        ExceptionBuilder::throw(HttpErrorCode::Unauthorized);
    }

    private function getUserAuthorizationFromHeaders(array $headers): string
    {
        foreach ($headers as $headerName => $headerValues) {
            // 统一兼容 user_authorization / User-Authorization 等写法。
            $normalizedName = str_replace('_', '-', strtolower((string) $headerName));
            if ($normalizedName === 'user-authorization' && ! empty($headerValues[0])) {
                // 去掉 Bearer 前缀，返回纯 token。
                return RequestUtil::parseAuthorizationToken((string) $headerValues[0]);
            }
        }
        return '';
    }

    /**
     * 获取 api-key（含兼容授权头）。
     */
    private function getApiKeyFromHeaders(array $headers): string
    {
        // 主路径：标准 api-key 头。
        $apiKey = RequestUtil::getApiKeyHeader($headers);
        if ($apiKey !== '') {
            return $apiKey;
        }
        // 兼容路径：历史 magic-authorization / authorization。
        $normalized = RequestUtil::normalizeHeaders($headers);
        foreach (['magic-authorization', 'authorization'] as $headerKey) {
            $authHeader = $normalized[$headerKey] ?? '';
            $apiKey = RequestUtil::parseAuthorizationToken($authHeader);
            if ($apiKey !== '') {
                return $apiKey;
            }
        }
        return '';
    }

    /**
     * 根据 headers 与 server params 获取客户端 IP 列表。
     */
    private function getClientIps(array $headers, array $serverParams = []): array
    {
        $ips = [];

        // 优先采集代理链首部，保留整条链路中的所有地址。
        $forwardedFor = $this->getHeaderValue($headers, 'x-forwarded-for');
        if ($forwardedFor !== '') {
            $forwardedIps = array_map('trim', explode(',', $forwardedFor));
            $ips = array_merge($ips, $forwardedIps);
        }

        // 补充反向代理透传的真实来源 IP。
        $realIp = $this->getHeaderValue($headers, 'x-real-ip');
        if ($realIp !== '') {
            $ips[] = $realIp;
        }

        // 最后兜底 remote_addr，避免头部缺失时审计无 IP。
        if (isset($serverParams['remote_addr']) && $serverParams['remote_addr'] !== '') {
            $ips[] = $serverParams['remote_addr'];
        }

        // 去重并去空，供 token IP 校验与审计复用。
        return array_unique(array_filter($ips));
    }

    private function getHeaderValue(array $headers, string $headerName): string
    {
        $lowerHeaderName = strtolower($headerName);
        foreach ($headers as $name => $values) {
            if (strtolower((string) $name) === $lowerHeaderName) {
                return ! empty($values[0]) ? (string) $values[0] : '';
            }
        }
        return '';
    }

    /**
     * user-authorization 入口：仅解析用户令牌（不尝试 AccessToken）。
     * mgw_ 前缀走 ModelGatewayUser 新链路，非 mgw_ 仅兼容 User。
     *
     * @param array<string,mixed> $headers
     * @param array<string,mixed> $serverParams
     */
    private function authenticateByUserAuthorization(string $userAuthorizationHeader, array $headers, array $serverParams): ?ApiKeyAuthResult
    {
        if ($userAuthorizationHeader === '') {
            return null;
        }

        // user-authorization 仅走“用户令牌族”，不参与 AccessToken 解析。
        if (ModelGatewayTokenKey::isModelGatewayApiKey($userAuthorizationHeader)) {
            // mgw_ 前缀：严格走 ModelGatewayUser 表项。
            $resolved = $this->resolveModelGatewayUserToken($userAuthorizationHeader, 'user-authorization');
        } else {
            // 非 mgw_：仅兼容历史 User token。
            $resolved = $this->resolveMagicUserTokenByType($userAuthorizationHeader, 'user-authorization', $headers, $serverParams);
        }

        if (! $resolved instanceof MagicUserTokenResolveResult) {
            return null;
        }

        return new ApiKeyAuthResult(
            null,
            $resolved->authorization,
            null,
            null,
            'user-authorization',
            $resolved->tokenType
        );
    }

    /**
     * api-key 入口：先按历史 AccessToken 鉴权，再回退到用户令牌族。
     * 这样可同时满足历史调用与“新 mgw_ token 直接当 api-key 使用”。
     *
     * @param array<string,mixed> $headers
     * @param array<string,mixed> $serverParams
     */
    private function authenticateByApiKey(string $apiKey, array $headers, array $serverParams): ?ApiKeyAuthResult
    {
        if ($apiKey === '') {
            return null;
        }

        // 新链路：mgw_ token 直接按 ModelGatewayUser 解析，不再走 AccessToken。
        if (ModelGatewayTokenKey::isModelGatewayApiKey($apiKey)) {
            $resolved = $this->resolveModelGatewayUserToken($apiKey, 'api-key');
            if (! $resolved instanceof MagicUserTokenResolveResult) {
                return null;
            }

            return new ApiKeyAuthResult(
                null,
                $resolved->authorization,
                null,
                null,
                'api-key',
                $resolved->tokenType
            );
        }

        $accessTokenEntity = $this->resolveAccessToken($apiKey, $headers, $serverParams);
        if ($accessTokenEntity instanceof AccessTokenEntity) {
            // 历史主链路：命中 AccessToken 后按类型补齐用户上下文（仅 User 类型可补齐）。
            return new ApiKeyAuthResult(
                $accessTokenEntity,
                $this->buildUserContextIfNeeded($accessTokenEntity),
                $apiKey,
                null,
                'api-key',
                'AccessToken:' . $accessTokenEntity->getType()->value
            );
        }

        $resolved = $this->resolveMagicUserTokenByType($apiKey, 'api-key', $headers, $serverParams);
        if (! $resolved instanceof MagicUserTokenResolveResult) {
            return null;
        }

        // 最后兼容：将 api-key 当作历史 User token 解析（过渡期保留）。
        return new ApiKeyAuthResult(
            null,
            $resolved->authorization,
            null,
            null,
            'api-key',
            $resolved->tokenType
        );
    }

    /**
     * 解析 AccessToken（历史 API-Key 体系）。
     * 仅在实体存在、启用且通过过期/IP 校验时返回。
     *
     * @param array<string,mixed> $headers
     * @param array<string,mixed> $serverParams
     */
    private function resolveAccessToken(string $apiKey, array $headers, array $serverParams): ?AccessTokenEntity
    {
        try {
            // 第一步：按原始 api-key 查实体，不存在直接返回 null（非异常路径）。
            $accessTokenEntity = $this->accessTokenDomainService->getByAccessToken($apiKey);
            if ($accessTokenEntity === null) {
                $this->logger->info('AuthFlow apikey token not found');
                return null;
            }

            // 第二步：状态校验，禁用 token 不可继续参与鉴权。
            if (! $accessTokenEntity->isEnabled()) {
                $this->logger->info('AuthFlow apikey token disabled', [
                    'type' => $accessTokenEntity->getType()->value,
                    'relation_id' => $accessTokenEntity->getRelationId(),
                ]);
                return null;
            }

            try {
                // 第三步：业务约束校验（过期 + IP 白名单）。
                $accessTokenEntity->checkExpiredTime(new DateTime());
                $accessTokenEntity->checkIps($this->getClientIps($headers, $serverParams));
            } catch (BusinessException $businessException) {
                // 业务异常保持上抛，让上层按统一错误语义处理。
                throw $businessException;
            } catch (Throwable $checkException) {
                // 非业务异常视为校验失败，降级为 null，不中断主流程。
                $this->logger->info('AuthFlow apikey token validation failed', [
                    'type' => $accessTokenEntity->getType()->value,
                    'relation_id' => $accessTokenEntity->getRelationId(),
                    'error' => $checkException->getMessage(),
                ]);
                return null;
            }

            return $accessTokenEntity;
        } catch (BusinessException $businessException) {
            // 保留业务异常语义（如明确 Unauthorized/Forbidden）。
            throw $businessException;
        } catch (Throwable $exception) {
            // 兜底异常不影响后续 fallback 路径，只记录 warning。
            $this->logger->warning('AuthFlow apikey unexpected exception', [
                'error' => $exception->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * ModelGatewayUser 专用链路：
     * - 仅受理 mgw_ 前缀 token；
     * - 仅查询 type=ModelGatewayUser 且按 sha256(token) 命中。
     */
    private function resolveModelGatewayUserToken(
        string $token,
        string $headerSource
    ): ?MagicUserTokenResolveResult {
        // 统一 token 规范化，避免调用方携带额外前后缀导致漏匹配。
        $normalizedToken = ModelGatewayTokenKey::normalize($token);
        if (! ModelGatewayTokenKey::isModelGatewayApiKey($normalizedToken)) {
            return null;
        }

        // 存储层按 hash 命中，避免落库明文。
        $storedToken = ModelGatewayTokenKey::hashForStorage($normalizedToken);
        $tokenEntity = $this->magicTokenRepository->queryTokenEntity(MagicTokenType::ModelGatewayUser, $storedToken);
        if ($tokenEntity === null) {
            return null;
        }

        // token -> user_id 映射必须完整，否则按无效 token 处理。
        $userId = trim($tokenEntity->getTypeRelationValue());
        if ($userId === '') {
            $this->logger->warning('AuthFlow magic token relation value empty', [
                'class' => self::class,
                'token_type' => MagicTokenType::ModelGatewayUser->name,
                'header_source' => $headerSource,
            ]);
            return null;
        }

        // 二次确认 user_id 在用户域可解析，避免脏数据放行。
        $authorization = $this->buildUserContextByUserId($userId);
        if (! $authorization instanceof MagicUserAuthorization) {
            $this->logger->warning('AuthFlow magic token user not found', [
                'class' => self::class,
                'token_type' => MagicTokenType::ModelGatewayUser->name,
                'header_source' => $headerSource,
                'user_id' => $userId,
            ]);
            return null;
        }

        return new MagicUserTokenResolveResult(
            authorization: $authorization,
            tokenType: MagicTokenType::ModelGatewayUser->name,
            userId: $userId
        );
    }

    /**
     * 非 mgw_ token 的兼容路径：仅查询 MagicTokenType::User。
     */
    private function resolveMagicUserTokenByType(
        string $token,
        string $headerSource,
        array $headers,
        array $serverParams
    ): ?MagicUserTokenResolveResult {
        // 兼容路径同样先做 token 归一化。
        $token = ModelGatewayTokenKey::normalize($token);
        if ($token === '') {
            return null;
        }

        // 历史 User token 走短 token 查询规则。
        $lookupToken = MagicTokenEntity::getShortToken($token);
        $tokenEntity = $this->magicTokenRepository->queryTokenEntity(MagicTokenType::User, $lookupToken);
        if ($tokenEntity === null) {
            return null;
        }

        // 从 token 实体读取 user_id 并构建鉴权上下文。
        $userId = trim($tokenEntity->getTypeRelationValue());
        if ($userId === '') {
            $this->logger->warning('AuthFlow magic token relation value empty', [
                'class' => self::class,
                'token_type' => MagicTokenType::User->name,
                'header_source' => $headerSource,
            ]);
            return null;
        }

        $authorization = $this->buildUserContextByUserId($userId);
        if (! $authorization instanceof MagicUserAuthorization) {
            $this->logger->warning('AuthFlow magic token user not found', [
                'class' => self::class,
                'token_type' => MagicTokenType::User->name,
                'header_source' => $headerSource,
                'user_id' => $userId,
            ]);
            return null;
        }

        // 过渡兼容命中旧沙箱用户 token，单独打点便于后续评估下线窗口。
        $this->auditAuthEvent(
            'legacy_user_token_authenticated',
            $headers,
            $serverParams,
            $headerSource,
            $headerSource,
            MagicTokenType::User->name,
            $userId,
            0
        );

        return new MagicUserTokenResolveResult(
            authorization: $authorization,
            tokenType: MagicTokenType::User->name,
            userId: $userId
        );
    }

    /**
     * 在 user-authorization 已命中时，额外“静默”探测 api-key：
     * - 若也命中且 user_id 不一致，记录冲突审计；
     * - 不改变最终决策（仍按优先级选择 user-authorization）。
     *
     * @param array<string,mixed> $headers
     * @param array<string,mixed> $serverParams
     */
    private function auditConflict(
        ApiKeyAuthResult $userAuthorizationResult,
        string $apiKey,
        array $headers,
        array $serverParams
    ): void {
        // 未携带 api-key 时无需冲突探测。
        if ($apiKey === '') {
            return;
        }

        // 旁路再跑一次 api-key 鉴权，仅用于审计，不参与主决策。
        $apiKeyResult = $this->authenticateByApiKeySilently($apiKey, $headers, $serverParams);
        if (! $apiKeyResult instanceof ApiKeyAuthResult) {
            return;
        }

        // 仅当两路都能解析出 user_id 且不一致时记录冲突。
        $selectedUserId = $this->extractUserIdFromResult($userAuthorizationResult);
        $fallbackUserId = $this->extractUserIdFromResult($apiKeyResult);
        if ($selectedUserId === '' || $fallbackUserId === '' || $selectedUserId === $fallbackUserId) {
            return;
        }

        $this->auditAuthEvent(
            'conflict_resolved_by_priority',
            $headers,
            $serverParams,
            'user-authorization,api-key',
            'user-authorization',
            $userAuthorizationResult->authTokenType,
            $selectedUserId,
            0,
            [
                'fallback_user_id' => $fallbackUserId,
                'fallback_token_type' => $apiKeyResult->authTokenType,
            ]
        );
    }

    /**
     * 冲突探测是旁路逻辑，任何异常都不影响主鉴权结果。
     *
     * @param array<string,mixed> $headers
     * @param array<string,mixed> $serverParams
     */
    private function authenticateByApiKeySilently(string $apiKey, array $headers, array $serverParams): ?ApiKeyAuthResult
    {
        try {
            return $this->authenticateByApiKey($apiKey, $headers, $serverParams);
        } catch (Throwable $exception) {
            $this->logger->info('AuthFlow api-key conflict-check skipped due to exception', [
                'error' => $exception->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * 统一失败审计入口，便于保持日志字段一致。
     *
     * @param array<string,mixed> $headers
     * @param array<string,mixed> $serverParams
     */
    private function auditAuthFailed(array $headers, array $serverParams, string $headerSource, string $reason): void
    {
        $this->auditAuthEvent(
            'auth_failed',
            $headers,
            $serverParams,
            $headerSource,
            '',
            '',
            '',
            HttpErrorCode::Unauthorized->value,
            ['reason' => $reason]
        );
    }

    /**
     * 审计日志统一结构：
     * - header_source：请求携带了哪些头；
     * - selected_source/selected_token_type：最终选中的来源与类型；
     * - result_code：0 代表成功，非 0 代表失败。
     *
     * @param array<string,mixed> $headers
     * @param array<string,mixed> $serverParams
     * @param array<string,mixed> $extraContext
     */
    private function auditAuthEvent(
        string $action,
        array $headers,
        array $serverParams,
        string $headerSource,
        string $selectedSource,
        string $selectedTokenType,
        string $userId,
        int $resultCode,
        array $extraContext = []
    ): void {
        // 公共上下文：保证每条审计至少具备 action/user/trace/source/result。
        $ips = $this->getClientIps($headers, $serverParams);
        $auditContext = array_merge([
            'action' => $action,
            'user_id' => $userId,
            'ip' => $ips[0] ?? '',
            'trace_id' => CoContext::getTraceId(),
            'header_source' => $headerSource,
            'selected_source' => $selectedSource,
            'selected_token_type' => $selectedTokenType,
            'result_code' => $resultCode,
        ], $extraContext);

        // 失败事件 + 关键迁移事件统一打 warning，便于告警与聚合检索。
        if ($resultCode !== 0 || in_array($action, ['legacy_user_token_authenticated', 'conflict_resolved_by_priority'], true)) {
            $this->logger->warning('ModelGatewayToken audit', $auditContext);
            return;
        }

        // 普通成功事件按 info 落盘，降低噪音。
        $this->logger->info('ModelGatewayToken audit', $auditContext);
    }

    /**
     * 仅用于审计：判断请求实际携带了哪些头来源。
     */
    private function detectHeaderSource(string $userAuthorizationHeader, string $apiKey): string
    {
        if ($userAuthorizationHeader !== '' && $apiKey !== '') {
            return 'user-authorization,api-key';
        }
        if ($userAuthorizationHeader !== '') {
            return 'user-authorization';
        }
        if ($apiKey !== '') {
            return 'api-key';
        }
        return 'none';
    }

    /**
     * 统一提取用户 ID，供冲突审计与 fallback 审计使用。
     */
    private function extractUserIdFromResult(ApiKeyAuthResult $result): string
    {
        // 优先使用已构建的用户上下文中的 user_id。
        $userId = trim($result->userAuthorization?->getId() ?? '');
        if ($userId !== '') {
            return $userId;
        }

        // 无用户上下文时，仅允许从 User 类型 AccessToken 回推 relation_id。
        $accessTokenEntity = $result->accessTokenEntity;
        if (! $accessTokenEntity instanceof AccessTokenEntity || $accessTokenEntity->getType() !== AccessTokenType::User) {
            return '';
        }

        return trim($accessTokenEntity->getRelationId());
    }

    /**
     * 只有 AccessTokenType::User 才能映射为用户上下文。
     */
    private function buildUserContextIfNeeded(AccessTokenEntity $accessTokenEntity): ?MagicUserAuthorization
    {
        if ($accessTokenEntity->getType() !== AccessTokenType::User) {
            return null;
        }

        return $this->buildUserContextByUserId($accessTokenEntity->getRelationId());
    }

    /**
     * 按 user_id 补齐模型网关需要的最小用户上下文信息。
     */
    private function buildUserContextByUserId(string $userId): ?MagicUserAuthorization
    {
        if ($userId === '') {
            return null;
        }

        // 用户不存在直接返回 null，交由上层决定是否拒绝。
        $userEntity = $this->magicUserDomainService->getUserById($userId);
        if ($userEntity === null) {
            return null;
        }

        // 统一补齐鉴权后续常用字段，避免调用方重复查用户资料。
        $authorization = MagicUserAuthorization::fromUserEntity($userEntity);
        $authorization->setNickname($userEntity->getNickname());
        $authorization->setAvatar($userEntity->getAvatarUrl());
        $authorization->setStatus((string) $userEntity->getStatus()->value);

        return $authorization;
    }
}
