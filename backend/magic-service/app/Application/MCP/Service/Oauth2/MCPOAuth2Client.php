<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Service\Oauth2;

use App\Domain\MCP\Entity\ValueObject\OAuth2AuthResult;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\Oauth2Config;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\RequestOptions;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;
use Throwable;

/**
 * OAuth2 Client Service.
 *
 * Handles OAuth2 authorization flow using facile-it/php-openid-client library.
 * Provides methods for authorization URL generation, callback handling, and token management.
 */
class MCPOAuth2Client
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly ConfigInterface $config,
        private readonly CacheInterface $cache,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('MCPOAuth2Client');
    }

    /**
     * Create authorization URL for OAuth2 flow.
     */
    public function createOauthUrl(
        Oauth2Config $config,
        string $state,
        ?string $codeChallenge = null,
        ?string $redirectUri = null
    ): string {
        try {
            // For simple OAuth2 flows, build URL manually
            $params = [
                'client_id' => $config->getClientId(),
                'redirect_uri' => $redirectUri ?: $this->getRedirectUri(),
                'response_type' => 'code',
                'scope' => $config->getScope(),
                'state' => $state,
            ];

            if ($codeChallenge) {
                $params['code_challenge'] = $codeChallenge;
                $params['code_challenge_method'] = 'S256';
            }

            return $this->buildUrlWithParams($config->getClientUrl(), $params);
        } catch (Throwable $e) {
            $this->logger->error('FailedToCreateAuthorizationURL', [
                'error' => $e->getMessage(),
                'client_id' => $config->getClientId(),
            ]);
            ExceptionBuilder::throw(MCPErrorCode::OAuth2AuthorizationUrlGenerationFailed);
        }
    }

    /**
     * Handle OAuth2 callback and exchange code for tokens.
     */
    public function handleCallback(
        Oauth2Config $config,
        array $callbackParams,
        ?string $redirectUri = null
    ): OAuth2AuthResult {
        try {
            $tokenParams = [
                'grant_type' => 'authorization_code',
                'code' => $callbackParams['code'],
                'redirect_uri' => $redirectUri ?: $this->getRedirectUri(),
                'client_id' => $config->getClientId(),
                'client_secret' => $config->getClientSecret(),
            ];

            if (isset($callbackParams['code_verifier'])) {
                $tokenParams['code_verifier'] = $callbackParams['code_verifier'];
            }

            $response = $this->exchangeCodeForTokens($config, $tokenParams);

            $this->logger->info('OAuth2CallbackHandledSuccessfully', [
                'client_id' => $config->getClientId(),
                'has_refresh_token' => ! empty($response['refresh_token']),
                'expires_in' => $response['expires_in'] ?? null,
            ]);

            return OAuth2AuthResult::fromOAuth2Response($response);
        } catch (Throwable $e) {
            $this->logger->error('OAuth2CallbackHandlingFailed', [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'error' => $e->getMessage(),
                'client_id' => $config->getClientId(),
                'code' => $callbackParams['code'] ?? 'missing',
            ]);
            ExceptionBuilder::throw(MCPErrorCode::OAuth2CallbackHandlingFailed);
        }
    }

    /**
     * Refresh access token using refresh token.
     */
    public function refreshToken(
        Oauth2Config $config,
        string $refreshToken
    ): OAuth2AuthResult {
        try {
            $tokenParams = [
                'grant_type' => 'refresh_token',
                'refresh_token' => $refreshToken,
                'client_id' => $config->getClientId(),
                'client_secret' => $config->getClientSecret(),
            ];

            $response = $this->makeTokenRequest($config, $tokenParams);

            $this->logger->info('OAuth2TokenRefreshedSuccessfully', [
                'client_id' => $config->getClientId(),
                'expires_in' => $response['expires_in'] ?? null,
            ]);

            return OAuth2AuthResult::fromOAuth2Response($response);
        } catch (Throwable $e) {
            $this->logger->error('OAuth2TokenRefreshFailed', [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'error' => $e->getMessage(),
                'client_id' => $config->getClientId(),
            ]);
            ExceptionBuilder::throw(MCPErrorCode::OAuth2TokenRefreshFailed, $e->getMessage());
        }
    }

    /**
     * Revoke OAuth2 token.
     */
    public function revokeToken(
        Oauth2Config $config,
        string $token,
        string $tokenType = 'access_token'
    ): bool {
        try {
            // Not all OAuth2 providers support token revocation
            // This is a placeholder implementation
            $this->logger->info('OAuth2TokenRevocationRequested', [
                'client_id' => $config->getClientId(),
                'token_type' => $tokenType,
            ]);

            return true;
        } catch (Throwable $e) {
            $this->logger->error('OAuth2TokenRevocationFailed', [
                'error' => $e->getMessage(),
                'client_id' => $config->getClientId(),
                'token_type' => $tokenType,
            ]);
            return false;
        }
    }

    /**
     * Introspect OAuth2 token.
     */
    public function introspectToken(
        Oauth2Config $config,
        string $token
    ): array {
        try {
            // Not all OAuth2 providers support token introspection
            // This is a placeholder implementation
            $this->logger->info('OAuth2TokenIntrospectionRequested', [
                'client_id' => $config->getClientId(),
            ]);

            return ['active' => true];
        } catch (Throwable $e) {
            $this->logger->error('OAuth2TokenIntrospectionFailed', [
                'error' => $e->getMessage(),
                'client_id' => $config->getClientId(),
            ]);
            return ['active' => false];
        }
    }

    /**
     * Generate state parameter for OAuth2 flow.
     */
    public function generateState(): string
    {
        return bin2hex(random_bytes(16));
    }

    /**
     * Generate code verifier for PKCE.
     */
    public function generateCodeVerifier(): string
    {
        return bin2hex(random_bytes(32));
    }

    /**
     * Generate code challenge for PKCE.
     */
    public function generateCodeChallenge(string $codeVerifier): string
    {
        return rtrim(strtr(base64_encode(hash('sha256', $codeVerifier, true)), '+/', '-_'), '=');
    }

    /**
     * Store state data in cache.
     */
    public function storeStateData(string $state, array $data, int $ttl = 600): void
    {
        $this->cache->set("oauth2_state_{$state}", $data, $ttl);
    }

    /**
     * Retrieve state data from cache.
     */
    public function getStateData(string $state): ?array
    {
        if (empty($state)) {
            return null; // Invalid state parameter
        }
        return $this->cache->get("oauth2_state_{$state}");
    }

    /**
     * Clear state data from cache.
     */
    public function clearStateData(string $state): void
    {
        $this->cache->delete("oauth2_state_{$state}");
    }

    /**
     * Generate redirect URI based on app_host configuration.
     */
    private function getRedirectUri(): string
    {
        $appHost = $this->config->get('app_host', 'https://localhost');
        return rtrim($appHost, '/') . '/api/v1/mcp/oauth2/callback';
    }

    /**
     * Build URL with parameters, merging existing query parameters if any.
     */
    private function buildUrlWithParams(string $baseUrl, array $params): string
    {
        $parsedUrl = parse_url($baseUrl);

        // Extract existing query parameters
        $existingParams = [];
        if (isset($parsedUrl['query'])) {
            parse_str($parsedUrl['query'], $existingParams);
        }

        // Merge existing and new parameters (new parameters override existing ones)
        $allParams = array_merge($existingParams, $params);

        // Rebuild the URL
        $scheme = $parsedUrl['scheme'] ?? 'https';
        $host = $parsedUrl['host'] ?? '';
        $port = isset($parsedUrl['port']) ? ':' . $parsedUrl['port'] : '';
        $path = $parsedUrl['path'] ?? '';
        $fragment = isset($parsedUrl['fragment']) ? '#' . $parsedUrl['fragment'] : '';

        $url = $scheme . '://' . $host . $port . $path;

        if (! empty($allParams)) {
            $url .= '?' . http_build_query($allParams);
        }

        $url .= $fragment;

        return $url;
    }

    /**
     * Exchange authorization code for access token.
     */
    private function exchangeCodeForTokens(Oauth2Config $config, array $params): array
    {
        return $this->makeTokenRequest($config, $params);
    }

    /**
     * Make token request to OAuth2 provider.
     */
    private function makeTokenRequest(Oauth2Config $config, array $params): array
    {
        $client = new GuzzleClient([
            'timeout' => 30,
            'connect_timeout' => 10,
        ]);

        // Prepare HTTP Basic Authentication
        $clientId = $config->getClientId();
        $clientSecret = $config->getClientSecret();
        $basicAuth = base64_encode($clientId . ':' . $clientSecret);

        // Prepare request options based on configured content type
        $contentType = $config->getAuthorizationContentType();
        $options = [
            RequestOptions::HEADERS => [
                'Authorization' => 'Basic ' . $basicAuth,
                'Accept' => 'application/json',
                'Content-Type' => $contentType,
            ],
        ];

        // Set request body based on content type
        if ($contentType === 'application/json') {
            $options[RequestOptions::JSON] = $params;
        } else {
            // Fallback for other content types (though currently only application/json is supported)
            $options[RequestOptions::FORM_PARAMS] = $params;
        }

        // Use token endpoint URL for exchanging code for access_token
        $tokenUrl = $config->getAuthorizationUrl(); // This is the token endpoint
        $response = $client->post($tokenUrl, $options);
        $body = $response->getBody()->getContents();

        $data = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ExceptionBuilder::throw(MCPErrorCode::OAuth2InvalidResponse, 'Invalid JSON response from OAuth2 provider');
        }

        if (isset($data['error'])) {
            ExceptionBuilder::throw(MCPErrorCode::OAuth2ProviderError, 'OAuth2 provider error: ' . $data['error']);
        }

        if (empty($data['access_token'])) {
            ExceptionBuilder::throw(MCPErrorCode::OAuth2MissingAccessToken, 'No access token received from OAuth2 provider');
        }

        return $data;
    }
}
