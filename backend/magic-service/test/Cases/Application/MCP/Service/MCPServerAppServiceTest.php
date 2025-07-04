<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Application\MCP\Service;

use App\Domain\MCP\Constant\ServiceConfigAuthType;
use App\Domain\MCP\Entity\ValueObject\OAuth2AuthResult;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\HeaderConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\Oauth2Config;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class MCPServerAppServiceTest extends TestCase
{
    public function testRequiredFieldsExtraction()
    {
        // Test field extraction from URL
        $serviceConfig = new ExternalSSEServiceConfig();
        $serviceConfig->setUrl('https://api.example.com/${api_key}/v1/tools?user=${user_id}&token=${access_token}');

        $requiredFields = $serviceConfig->getRequireFields();
        $this->assertContains('api_key', $requiredFields);
        $this->assertContains('user_id', $requiredFields);
        $this->assertContains('access_token', $requiredFields);
    }

    public function testRequiredFieldsFromHeaders()
    {
        // Test field extraction from headers
        $serviceConfig = new ExternalSSEServiceConfig();
        $serviceConfig->setUrl('https://api.example.com/v1/tools');

        $header = new HeaderConfig();
        $header->setKey('X-API-Key');
        $header->setValue('${api_key}');
        $serviceConfig->setHeaders([$header]);

        $requiredFields = $serviceConfig->getRequireFields();
        $this->assertContains('api_key', $requiredFields);
    }

    public function testRequiredFieldsReplacement()
    {
        // Test field replacement in service config
        $serviceConfig = new ExternalSSEServiceConfig();
        $serviceConfig->setUrl('https://api.example.com/${api_key}/v1/tools?user=${user_id}');

        $header = new HeaderConfig();
        $header->setKey('Authorization');
        $header->setValue('Bearer ${access_token}');
        $serviceConfig->setHeaders([$header]);

        $fieldValues = [
            'api_key' => 'sk-1234567890',
            'user_id' => 'user-123',
            'access_token' => 'token-abc123',
        ];

        $updatedConfig = $serviceConfig->replaceRequiredFields($fieldValues);

        $this->assertEquals('https://api.example.com/sk-1234567890/v1/tools?user=user-123', $updatedConfig->getUrl());
        $this->assertEquals('Bearer token-abc123', $updatedConfig->getHeaders()[0]->getValue());
    }

    public function testOAuth2AuthResultValidation()
    {
        // Create a mock OAuth2 result
        $oauth2Result = new OAuth2AuthResult();
        $oauth2Result->setAccessToken('test-access-token');
        $oauth2Result->setTokenType('Bearer');
        $oauth2Result->setExpiresIn(3600); // 1 hour from now

        // Verify OAuth2 result is valid
        $this->assertTrue($oauth2Result->isValid());
        $this->assertEquals('Bearer test-access-token', $oauth2Result->getAuthorizationHeader());
    }

    public function testOAuth2ConfigValidation()
    {
        // Create OAuth2 configuration
        $oauth2Config = new Oauth2Config();
        $oauth2Config->setClientId('test-client-id');
        $oauth2Config->setClientSecret('test-client-secret');
        $oauth2Config->setClientUrl('https://oauth.example.com/authorize');
        $oauth2Config->setAuthorizationUrl('https://oauth.example.com/token');
        $oauth2Config->setScope('read write');

        // Test configuration properties
        $this->assertEquals('test-client-id', $oauth2Config->getClientId());
        $this->assertEquals('test-client-secret', $oauth2Config->getClientSecret());
        $this->assertEquals('https://oauth.example.com/authorize', $oauth2Config->getClientUrl());
        $this->assertEquals('https://oauth.example.com/token', $oauth2Config->getAuthorizationUrl());
        $this->assertEquals('read write', $oauth2Config->getScope());
    }

    public function testServiceConfigWithAuthType()
    {
        // Test service config with different auth types
        $serviceConfig = new ExternalSSEServiceConfig();
        $serviceConfig->setUrl('https://example.com/mcp/tools');
        $serviceConfig->setAuthType(ServiceConfigAuthType::OAUTH2);

        $this->assertEquals(ServiceConfigAuthType::OAUTH2, $serviceConfig->getAuthType());

        // Test with none auth type
        $serviceConfig->setAuthType(ServiceConfigAuthType::NONE);
        $this->assertEquals(ServiceConfigAuthType::NONE, $serviceConfig->getAuthType());
    }
}
