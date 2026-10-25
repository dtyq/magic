<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Google\Auth;

use App\Infrastructure\Util\Http\GuzzleClientFactory;
use Exception;
use Google\Auth\Credentials\ServiceAccountCredentials;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;

final class GoogleServiceAccountTokenProvider
{
    private const string OAUTH_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

    private const string OAUTH_AUTH_URI = 'https://accounts.google.com/o/oauth2/auth';

    private const string OAUTH_TOKEN_URI = 'https://oauth2.googleapis.com/token';

    private const string OAUTH_CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';

    private LoggerInterface $logger;

    private Redis $redis;

    public function __construct(
        private readonly array $config,
        private readonly ?string $proxyUrl = null,
    ) {
        $this->logger = di(LoggerFactory::class)->get(self::class);
        $this->redis = di(Redis::class);
    }

    public function getAccessToken(): string
    {
        $cacheKey = $this->getCacheKey();
        $cachedToken = $this->redis->get($cacheKey);
        if (is_string($cachedToken) && $cachedToken !== '') {
            return $cachedToken;
        }

        $tokenData = $this->fetchToken();
        $accessToken = trim((string) ($tokenData['access_token'] ?? ''));
        if ($accessToken === '') {
            throw new Exception('Failed to fetch Google access token');
        }

        $expiresIn = max(1, (int) ($tokenData['expires_in'] ?? 3500) - 60);
        $this->redis->set($cacheKey, $accessToken, $expiresIn);

        return $accessToken;
    }

    public function invalidate(): void
    {
        $this->redis->del($this->getCacheKey());
    }

    private function fetchToken(): array
    {
        try {
            $jsonKey = [
                'type' => 'service_account',
                'project_id' => $this->config['project_id'] ?? '',
                'private_key_id' => $this->config['private_key_id'] ?? '',
                'private_key' => $this->config['private_key'] ?? '',
                'client_email' => $this->config['client_email'] ?? '',
                'client_id' => $this->config['client_id'] ?? '',
                'auth_uri' => $this->config['auth_uri'] ?? self::OAUTH_AUTH_URI,
                'token_uri' => $this->config['token_uri'] ?? self::OAUTH_TOKEN_URI,
                'auth_provider_x509_cert_url' => $this->config['auth_provider_x509_cert_url'] ?? self::OAUTH_CERTS_URL,
                'client_x509_cert_url' => $this->config['client_x509_cert_url'] ?? '',
            ];
            $credentials = new ServiceAccountCredentials([self::OAUTH_SCOPE], $jsonKey);
            $httpHandler = null;
            if ($this->proxyUrl !== null && trim($this->proxyUrl) !== '') {
                $client = GuzzleClientFactory::createProxyClient(['timeout' => 1200], $this->proxyUrl);
                $httpHandler = static fn ($request, $options = []) => $client->send($request, $options);
            }

            $token = $credentials->fetchAuthToken($httpHandler);
            if (! is_array($token) || ! isset($token['access_token'])) {
                throw new Exception('Failed to fetch Google access token');
            }

            return $token;
        } catch (Exception $exception) {
            $this->logger->error('Google Service Account 鉴权失败', ['error' => $exception->getMessage()]);
            throw $exception;
        }
    }

    private function getCacheKey(): string
    {
        $keySource = ($this->config['project_id'] ?? '')
            . ($this->config['client_email'] ?? '')
            . ($this->config['private_key'] ?? '')
            . ($this->config['private_key_id'] ?? '')
            . ($this->config['client_id'] ?? '')
            . self::OAUTH_SCOPE;

        return 'google_sa_token_' . md5($keySource);
    }
}
