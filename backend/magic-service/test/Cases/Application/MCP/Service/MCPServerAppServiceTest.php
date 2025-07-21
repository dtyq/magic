<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Application\MCP\Service;

use App\Domain\MCP\Constant\ServiceConfigAuthType;
use App\Domain\MCP\Entity\ValueObject\OAuth2AuthResult;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\EnvConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalStdioServiceConfig;
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

    public function testExternalStdioServiceConfigEnvGetterSetter()
    {
        // Test env getter and setter
        $serviceConfig = new ExternalStdioServiceConfig();

        // Test empty array by default
        $this->assertEquals([], $serviceConfig->getEnv());

        // Test setting env variables
        $env = [
            EnvConfig::create('API_KEY', 'test-key'),
            EnvConfig::create('DATABASE_URL', 'postgres://localhost/test'),
            EnvConfig::create('DEBUG', 'true'),
        ];

        $serviceConfig->setEnv($env);
        $this->assertEquals($env, $serviceConfig->getEnv());

        // Test getEnvArray method returns associative array
        $envArray = $serviceConfig->getEnvArray();
        $this->assertEquals([
            'API_KEY' => 'test-key',
            'DATABASE_URL' => 'postgres://localhost/test',
            'DEBUG' => 'true',
        ], $envArray);
    }

    public function testExternalStdioServiceConfigFromArrayWithEnv()
    {
        // Test fromArray method with env parameter
        $data = [
            'command' => 'npx',
            'arguments' => ['@modelcontextprotocol/server-everything'],
            'env' => [
                ['key' => 'API_KEY', 'value' => '${api_key}'],
                ['key' => 'BASE_URL', 'value' => 'https://api.example.com'],
                ['key' => 'USER_ID', 'value' => '${user_id}'],
            ],
        ];

        $serviceConfig = ExternalStdioServiceConfig::fromArray($data);

        $this->assertEquals('npx', $serviceConfig->getCommand());
        $this->assertEquals(['@modelcontextprotocol/server-everything'], $serviceConfig->getArguments());

        // Test env is converted to EnvConfig objects
        $env = $serviceConfig->getEnv();
        $this->assertCount(3, $env);
        $this->assertInstanceOf(EnvConfig::class, $env[0]);
        $this->assertEquals('API_KEY', $env[0]->getKey());
        $this->assertEquals('${api_key}', $env[0]->getValue());

        // Test getEnvArray returns correct associative array
        $envArray = $serviceConfig->getEnvArray();
        $this->assertEquals([
            'API_KEY' => '${api_key}',
            'BASE_URL' => 'https://api.example.com',
            'USER_ID' => '${user_id}',
        ], $envArray);
    }

    public function testExternalStdioServiceConfigToArrayWithEnv()
    {
        // Test toArray method includes env parameter
        $serviceConfig = new ExternalStdioServiceConfig();
        $serviceConfig->setCommand('npx');
        $serviceConfig->setArguments(['@modelcontextprotocol/server-everything']);

        $env = [
            EnvConfig::create('API_KEY', 'test-key'),
            EnvConfig::create('BASE_URL', 'https://api.example.com'),
        ];
        $serviceConfig->setEnv($env);

        $result = $serviceConfig->toArray();

        $this->assertEquals('npx', $result['command']);
        $this->assertEquals(['@modelcontextprotocol/server-everything'], $result['arguments']);

        // Test env is serialized as array
        $this->assertEquals([
            ['key' => 'API_KEY', 'value' => 'test-key'],
            ['key' => 'BASE_URL', 'value' => 'https://api.example.com'],
        ], $result['env']);
    }

    public function testExternalStdioServiceConfigToWebArrayWithEnv()
    {
        // Test toWebArray method includes env parameter
        $serviceConfig = new ExternalStdioServiceConfig();
        $serviceConfig->setCommand('npx');
        $serviceConfig->setArguments(['@modelcontextprotocol/server-everything', '--port', '3000']);

        $env = [
            EnvConfig::create('API_KEY', 'test-key'),
            EnvConfig::create('PORT', '3000'),
        ];
        $serviceConfig->setEnv($env);

        $result = $serviceConfig->toWebArray();

        $this->assertEquals('npx', $result['command']);
        $this->assertEquals('@modelcontextprotocol/server-everything --port 3000', $result['arguments']);

        // Test env is serialized as array
        $this->assertEquals([
            ['key' => 'API_KEY', 'value' => 'test-key'],
            ['key' => 'PORT', 'value' => '3000'],
        ], $result['env']);
    }

    public function testExternalStdioServiceConfigRequiredFieldsFromEnv()
    {
        // Test extraction of required fields from env values
        $serviceConfig = new ExternalStdioServiceConfig();
        $serviceConfig->setCommand('npx');
        $serviceConfig->setArguments(['@modelcontextprotocol/server-everything', '--api-key', '${api_key}']);

        $env = [
            EnvConfig::create('API_KEY', '${api_key}'),
            EnvConfig::create('DATABASE_URL', 'postgres://localhost:5432/${database_name}'),
            EnvConfig::create('USER_TOKEN', '${user_token}'),
            EnvConfig::create('STATIC_VALUE', 'no-placeholder-here'),
        ];
        $serviceConfig->setEnv($env);

        $requiredFields = $serviceConfig->getRequireFields();

        // Should extract fields from both arguments and env values
        $this->assertContains('api_key', $requiredFields);
        $this->assertContains('database_name', $requiredFields);
        $this->assertContains('user_token', $requiredFields);
        $this->assertNotContains('STATIC_VALUE', $requiredFields);
    }

    public function testExternalStdioServiceConfigReplaceRequiredFieldsInEnv()
    {
        // Test replacement of required fields in env values
        $serviceConfig = new ExternalStdioServiceConfig();
        $serviceConfig->setCommand('npx');
        $serviceConfig->setArguments(['@modelcontextprotocol/server-everything', '--token', '${access_token}']);

        $env = [
            EnvConfig::create('API_KEY', '${api_key}'),
            EnvConfig::create('DATABASE_URL', 'postgres://localhost:5432/${database_name}'),
            EnvConfig::create('USER_ID', '${user_id}'),
            EnvConfig::create('STATIC_VALUE', 'unchanged'),
        ];
        $serviceConfig->setEnv($env);

        $fieldValues = [
            'api_key' => 'sk-1234567890',
            'database_name' => 'test_db',
            'user_id' => 'user-123',
            'access_token' => 'token-abc123',
        ];

        $updatedConfig = $serviceConfig->replaceRequiredFields($fieldValues);

        // Check arguments replacement
        $this->assertEquals('token-abc123', $updatedConfig->getArguments()[2]);

        // Check env replacement through getEnvArray
        $updatedEnvArray = $updatedConfig->getEnvArray();
        $this->assertEquals('sk-1234567890', $updatedEnvArray['API_KEY']);
        $this->assertEquals('postgres://localhost:5432/test_db', $updatedEnvArray['DATABASE_URL']);
        $this->assertEquals('user-123', $updatedEnvArray['USER_ID']);
        $this->assertEquals('unchanged', $updatedEnvArray['STATIC_VALUE']);
    }

    public function testExternalStdioServiceConfigWithEmptyEnv()
    {
        // Test behavior with empty env
        $serviceConfig = new ExternalStdioServiceConfig();
        $serviceConfig->setCommand('npx');
        $serviceConfig->setArguments(['@modelcontextprotocol/server-everything', '--key', '${api_key}']);
        $serviceConfig->setEnv([]);

        $requiredFields = $serviceConfig->getRequireFields();

        // Should only extract from arguments, not from empty env
        $this->assertContains('api_key', $requiredFields);
        $this->assertCount(1, $requiredFields);

        // Test replacement with empty env
        $fieldValues = ['api_key' => 'test-key'];
        $updatedConfig = $serviceConfig->replaceRequiredFields($fieldValues);

        $this->assertEquals('test-key', $updatedConfig->getArguments()[2]);
        $this->assertEquals([], $updatedConfig->getEnv());
        $this->assertEquals([], $updatedConfig->getEnvArray());
    }
}
