<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\MCP;

use App\Domain\MCP\Constant\ServiceConfigAuthType;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\EnvConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalStdioServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalStreamableHttpServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\HeaderConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\NoneServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\Oauth2Config;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\SSEServiceConfig;
use App\Infrastructure\Core\Exception\BusinessException;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class ServiceConfigTest extends BaseTest
{
    public function testNoneServiceConfig()
    {
        $config = new NoneServiceConfig();

        // Test toArray
        $this->assertEquals([], $config->toArray());

        // Test fromArray
        $fromArray = NoneServiceConfig::fromArray([]);
        $this->assertInstanceOf(NoneServiceConfig::class, $fromArray);

        // Test validate
        $config->validate(); // Should not throw exception

        // Test getRequireFields
        $this->assertEquals([], $config->getRequireFields());
    }

    public function testHeaderConfig()
    {
        $config = new HeaderConfig();

        // Test setters/getters
        $config->setKey('Authorization');
        $config->setValue('Bearer token123');
        $config->setMapperSystemInput('system_input');

        $this->assertEquals('Authorization', $config->getKey());
        $this->assertEquals('Bearer token123', $config->getValue());
        $this->assertEquals('system_input', $config->getMapperSystemInput());

        // Test toArray
        $expected = [
            'key' => 'Authorization',
            'value' => 'Bearer token123',
            'mapper_system_input' => 'system_input',
        ];
        $this->assertEquals($expected, $config->toArray());

        // Test fromArray
        $fromArray = HeaderConfig::fromArray($expected);
        $this->assertEquals('Authorization', $fromArray->getKey());
        $this->assertEquals('Bearer token123', $fromArray->getValue());
        $this->assertEquals('system_input', $fromArray->getMapperSystemInput());

        // Test validate - valid case
        $config->validate();

        // Test validate - invalid case (value without key)
        $invalidConfig = new HeaderConfig();
        $invalidConfig->setValue('some value');
        $invalidConfig->setKey('');

        $this->expectException(BusinessException::class);
        $invalidConfig->validate();
    }

    public function testOauth2Config()
    {
        $config = new Oauth2Config();

        // Test setters/getters
        $config->setClientId('client123');
        $config->setClientSecret('secret456');
        $config->setClientUrl('https://api.github.com/oauth/token');
        $config->setScope('read write');
        $config->setAuthorizationUrl('https://api.github.com/oauth/authorize');
        $config->setAuthorizationContentType('application/json');

        $this->assertEquals('client123', $config->getClientId());
        $this->assertEquals('secret456', $config->getClientSecret());
        $this->assertEquals('https://api.github.com/oauth/token', $config->getClientUrl());
        $this->assertEquals('read write', $config->getScope());
        $this->assertEquals('https://api.github.com/oauth/authorize', $config->getAuthorizationUrl());
        $this->assertEquals('application/json', $config->getAuthorizationContentType());

        // Test toArray
        $expected = [
            'client_id' => 'client123',
            'client_secret' => 'secret456',
            'client_url' => 'https://api.github.com/oauth/token',
            'scope' => 'read write',
            'authorization_url' => 'https://api.github.com/oauth/authorize',
            'authorization_content_type' => 'application/json',
            'issuer_url' => '',
            'redirect_uri' => '',
            'use_pkce' => true,
            'response_type' => 'code',
            'grant_type' => 'authorization_code',
            'additional_params' => [],
        ];
        $this->assertEquals($expected, $config->toArray());

        // Test fromArray
        $fromArray = Oauth2Config::fromArray($expected);
        $this->assertEquals('client123', $fromArray->getClientId());
        $this->assertEquals('secret456', $fromArray->getClientSecret());

        // Test validate - valid case
        $config->validate();
    }

    public function testExternalStdioServiceConfig()
    {
        $config = new ExternalStdioServiceConfig();

        // Test setters/getters
        $config->setCommand('npx');
        $config->setArguments(['--key', 'value', '--flag']);

        // Test env setter/getter
        $env = [
            EnvConfig::create('API_KEY', '${api_key}'),
            EnvConfig::create('DATABASE_URL', 'postgres://localhost:5432/${db_name}'),
        ];
        $config->setEnv($env);

        $this->assertEquals('npx', $config->getCommand());
        $this->assertEquals(['--key', 'value', '--flag'], $config->getArguments());
        $this->assertEquals($env, $config->getEnv());

        // Test getEnvArray
        $envArray = $config->getEnvArray();
        $this->assertEquals([
            'API_KEY' => '${api_key}',
            'DATABASE_URL' => 'postgres://localhost:5432/${db_name}',
        ], $envArray);

        // Test toArray
        $expected = [
            'command' => 'npx',
            'arguments' => ['--key', 'value', '--flag'],
            'env' => [
                ['key' => 'API_KEY', 'value' => '${api_key}'],
                ['key' => 'DATABASE_URL', 'value' => 'postgres://localhost:5432/${db_name}'],
            ],
        ];
        $this->assertEquals($expected, $config->toArray());

        // Test fromArray
        $fromArray = ExternalStdioServiceConfig::fromArray($expected);
        $this->assertEquals('npx', $fromArray->getCommand());
        $this->assertEquals(['--key', 'value', '--flag'], $fromArray->getArguments());

        // Test env is properly loaded
        $loadedEnv = $fromArray->getEnv();
        $this->assertCount(2, $loadedEnv);
        $this->assertInstanceOf(EnvConfig::class, $loadedEnv[0]);
        $this->assertEquals('API_KEY', $loadedEnv[0]->getKey());
        $this->assertEquals('${api_key}', $loadedEnv[0]->getValue());

        // Test validate - valid case
        $config->validate();

        // Test getRequireFields with dynamic fields in arguments and env
        $configWithDynamicFields = ExternalStdioServiceConfig::fromArray([
            'command' => 'npx',
            'arguments' => ['--key', '${config_key}', '--path', '/tmp/${temp_dir}'],
            'env' => [
                ['key' => 'API_KEY', 'value' => '${api_key}'],
                ['key' => 'SECRET', 'value' => '${secret_value}'],
            ],
        ]);

        $requiredFields = $configWithDynamicFields->getRequireFields();
        $this->assertContains('config_key', $requiredFields);
        $this->assertContains('temp_dir', $requiredFields);
        $this->assertContains('api_key', $requiredFields);
        $this->assertContains('secret_value', $requiredFields);
        $this->assertCount(4, $requiredFields);

        // Test validate - invalid case (empty command)
        $invalidConfig = new ExternalStdioServiceConfig();
        $invalidConfig->setCommand('');
        $invalidConfig->setArguments(['arg1']);

        $this->expectException(BusinessException::class);
        $invalidConfig->validate();
    }

    public function testSSEServiceConfig()
    {
        $config = new SSEServiceConfig();

        // Test with headers
        $header1 = HeaderConfig::fromArray([
            'key' => 'Authorization',
            'value' => 'Bearer ${token}',
            'mapper_system_input' => '',
        ]);

        $header2 = HeaderConfig::fromArray([
            'key' => 'X-API-Key',
            'value' => '${api_key}',
            'mapper_system_input' => '',
        ]);

        $config->setHeaders([$header1, $header2]);

        // Test getters
        $headers = $config->getHeaders();
        $this->assertCount(2, $headers);
        $this->assertEquals('Authorization', $headers[0]->getKey());
        $this->assertEquals('Bearer ${token}', $headers[0]->getValue());

        // Test toArray
        $array = $config->toArray();
        $this->assertArrayHasKey('headers', $array);
        $this->assertCount(2, $array['headers']);

        // Test fromArray
        $fromArray = SSEServiceConfig::fromArray($array);
        $this->assertInstanceOf(SSEServiceConfig::class, $fromArray);
        $this->assertCount(2, $fromArray->getHeaders());

        // Test validate
        $config->validate();

        // Test getRequireFields
        $requiredFields = $config->getRequireFields();
        $this->assertContains('token', $requiredFields);
        $this->assertContains('api_key', $requiredFields);
    }

    public function testExternalSSEServiceConfig()
    {
        $config = new ExternalSSEServiceConfig();

        // Test setters/getters
        $config->setUrl('https://api.github.com/sse?key=${api_key}');
        $config->setAuthType(ServiceConfigAuthType::OAUTH2);

        $header = HeaderConfig::fromArray([
            'key' => 'X-Custom',
            'value' => '${header_value}',
            'mapper_system_input' => '',
        ]);
        $config->setHeaders([$header]);

        $oauth2Config = Oauth2Config::fromArray([
            'client_id' => '${client_id}',
            'client_secret' => 'secret123',
            'client_url' => 'https://api.github.com/oauth/token',
            'scope' => 'read',
            'authorization_url' => 'https://api.github.com/oauth/authorize',
            'authorization_content_type' => 'application/json',
        ]);
        $config->setOauth2Config($oauth2Config);

        // Test getters
        $this->assertEquals('https://api.github.com/sse?key=${api_key}', $config->getUrl());
        $this->assertEquals(ServiceConfigAuthType::OAUTH2, $config->getAuthType());
        $this->assertInstanceOf(Oauth2Config::class, $config->getOauth2Config());

        // Test toArray
        $array = $config->toArray();
        $this->assertArrayHasKey('url', $array);
        $this->assertArrayHasKey('headers', $array);
        $this->assertArrayHasKey('auth_type', $array);
        $this->assertArrayHasKey('oauth2_config', $array);
        $this->assertEquals(1, $array['auth_type']);

        // Test fromArray
        $fromArray = ExternalSSEServiceConfig::fromArray($array);
        $this->assertInstanceOf(ExternalSSEServiceConfig::class, $fromArray);
        $this->assertEquals('https://api.github.com/sse?key=${api_key}', $fromArray->getUrl());
        $this->assertEquals(ServiceConfigAuthType::OAUTH2, $fromArray->getAuthType());

        // Test validate - valid case
        $config->validate();

        // Test getRequireFields
        $requiredFields = $config->getRequireFields();
        $this->assertContains('api_key', $requiredFields);
        $this->assertContains('header_value', $requiredFields);

        // Test authType error handling
        $config->setAuthType(999); // Invalid auth type should default to NONE
        $this->assertEquals(ServiceConfigAuthType::NONE, $config->getAuthType());
    }

    public function testServiceConfigAuthType()
    {
        // Test enum values
        $this->assertEquals(0, ServiceConfigAuthType::NONE->value);
        $this->assertEquals(1, ServiceConfigAuthType::OAUTH2->value);

        // Test from method
        $this->assertEquals(ServiceConfigAuthType::NONE, ServiceConfigAuthType::from(0));
        $this->assertEquals(ServiceConfigAuthType::OAUTH2, ServiceConfigAuthType::from(1));

        // Test tryFrom method
        $this->assertEquals(ServiceConfigAuthType::NONE, ServiceConfigAuthType::tryFrom(0));
        $this->assertEquals(ServiceConfigAuthType::OAUTH2, ServiceConfigAuthType::tryFrom(1));
        $this->assertNull(ServiceConfigAuthType::tryFrom(999));
    }

    public function testExternalSSEServiceConfigValidation()
    {
        // Test invalid URL
        $config = new ExternalSSEServiceConfig();
        $config->setUrl('invalid-url');

        $this->expectException(BusinessException::class);
        $config->validate();
    }

    public function testExternalStdioServiceConfigValidation()
    {
        // Test empty arguments
        $config = new ExternalStdioServiceConfig();
        $config->setCommand('npx');
        $config->setArguments([]);

        $this->expectException(BusinessException::class);
        $config->validate();
    }

    public function testExternalStdioServiceConfigInvalidCommand()
    {
        // Test invalid command
        $config = new ExternalStdioServiceConfig();
        $config->setCommand('invalid_command');
        $config->setArguments(['some', 'args']);

        $this->expectException(BusinessException::class);
        $config->validate();
    }

    public function testExternalStdioServiceConfigValidCommand()
    {
        // Test valid command
        $config = new ExternalStdioServiceConfig();
        $config->setCommand('npx');
        $config->setArguments(['some', 'args']);

        // Should not throw exception
        $config->validate();
        $this->assertTrue(true); // Assert test passes
    }

    public function testOauth2ConfigValidation()
    {
        // Test missing required fields
        $config = new Oauth2Config();
        $config->setClientId(''); // Empty client_id
        $config->setClientSecret('secret');
        $config->setClientUrl('https://oauth.example.com/token');
        $config->setAuthorizationUrl('https://oauth.example.com/auth');

        $this->expectException(BusinessException::class);
        $config->validate();
    }

    public function testExternalSSEServiceConfigOAuth2Validation()
    {
        // Test OAuth2 validation only when authType is OAUTH2
        $config = new ExternalSSEServiceConfig();
        $config->setUrl('https://api.github.com/sse');
        $config->setAuthType(ServiceConfigAuthType::NONE);

        // Set invalid OAuth2 config
        $oauth2Config = new Oauth2Config();
        $oauth2Config->setClientId(''); // Invalid
        $config->setOauth2Config($oauth2Config);

        // Should not throw exception because authType is NONE
        $config->validate();

        // Now set authType to OAUTH2
        $config->setAuthType(ServiceConfigAuthType::OAUTH2);

        // Should throw exception because OAuth2 config is invalid
        $this->expectException(BusinessException::class);
        $config->validate();
    }

    public function testRequireFieldsExtraction()
    {
        // Test complex scenario with multiple dynamic fields
        $config = ExternalSSEServiceConfig::fromArray([
            'url' => 'https://api.github.com/sse/path/${path_param}?key=${api_key}&user=${user_id}',
            'headers' => [
                [
                    'key' => 'Authorization',
                    'value' => 'Bearer ${access_token}',
                    'mapper_system_input' => '',
                ],
                [
                    'key' => 'X-Custom-Header',
                    'value' => '${custom_value}',
                    'mapper_system_input' => '',
                ],
            ],
            'auth_type' => 0,
            'oauth2_config' => null,
        ]);

        $requiredFields = $config->getRequireFields();

        // Should contain all dynamic fields from URL path, query parameters, and headers only
        $expectedFields = [
            'path_param',
            'api_key',
            'user_id',
            'access_token',
            'custom_value',
        ];

        foreach ($expectedFields as $field) {
            $this->assertContains($field, $requiredFields, "Missing required field: {$field}");
        }

        // Should not contain duplicates
        $this->assertEquals(count($expectedFields), count($requiredFields));
    }

    public function testRequireFieldsExtractionExcludesDomain()
    {
        // Test that domain variables are NOT extracted
        $config = ExternalSSEServiceConfig::fromArray([
            'url' => 'https://${domain}.api.com/sse/path/${path_param}?key=${api_key}',
            'headers' => [
                [
                    'key' => 'Authorization',
                    'value' => 'Bearer ${access_token}',
                    'mapper_system_input' => '',
                ],
            ],
            'auth_type' => 0,
            'oauth2_config' => null,
        ]);

        $requiredFields = $config->getRequireFields();

        // Should NOT contain domain variable
        $this->assertNotContains('domain', $requiredFields, 'Domain variable should not be extracted');

        // Should contain path and query variables
        $this->assertContains('path_param', $requiredFields, 'Path variable should be extracted');
        $this->assertContains('api_key', $requiredFields, 'Query variable should be extracted');
        $this->assertContains('access_token', $requiredFields, 'Header variable should be extracted');

        // Should contain exactly 3 fields: path_param, api_key, access_token
        $this->assertEquals(3, count($requiredFields));
    }

    public function testExternalStreamableHttpServiceConfig()
    {
        // Test that ExternalStreamableHttpServiceConfig inherits all functionality from ExternalSSEServiceConfig
        $config = new ExternalStreamableHttpServiceConfig();

        // Test setters/getters (inherited from parent)
        $config->setUrl('https://api.github.com/stream?key=${api_key}');
        $config->setAuthType(ServiceConfigAuthType::NONE);

        $header = HeaderConfig::fromArray([
            'key' => 'X-Stream-Type',
            'value' => '${stream_type}',
            'mapper_system_input' => '',
        ]);
        $config->setHeaders([$header]);

        // Test getters (inherited)
        $this->assertEquals('https://api.github.com/stream?key=${api_key}', $config->getUrl());
        $this->assertEquals(ServiceConfigAuthType::NONE, $config->getAuthType());
        $this->assertCount(1, $config->getHeaders());

        // Test toArray (inherited)
        $array = $config->toArray();
        $this->assertArrayHasKey('url', $array);
        $this->assertArrayHasKey('headers', $array);
        $this->assertArrayHasKey('auth_type', $array);
        $this->assertEquals(0, $array['auth_type']);

        // Test fromArray (inherited)
        $fromArray = ExternalStreamableHttpServiceConfig::fromArray($array);
        $this->assertInstanceOf(ExternalStreamableHttpServiceConfig::class, $fromArray);
        $this->assertEquals('https://api.github.com/stream?key=${api_key}', $fromArray->getUrl());

        // Test validate (inherited)
        $config->validate();

        // Test getRequireFields (inherited)
        $requiredFields = $config->getRequireFields();
        $this->assertContains('api_key', $requiredFields);
        $this->assertContains('stream_type', $requiredFields);
        $this->assertCount(2, $requiredFields);
    }

    public function testReplaceRequiredFields()
    {
        // Test NoneServiceConfig
        $noneConfig = new NoneServiceConfig();
        $result = $noneConfig->replaceRequiredFields(['field1' => 'value1']);
        $this->assertSame($noneConfig, $result); // Same instance returned
        $this->assertEquals([], $noneConfig->getRequireFields());

        // Test ExternalStdioServiceConfig
        $stdioConfig = new ExternalStdioServiceConfig();
        $stdioConfig->setCommand('npx');
        $stdioConfig->setArguments(['script.py', '--param', '${user_id}', '--token', '${api_token}']);

        // Test env replacement
        $env = [
            EnvConfig::create('API_KEY', '${api_key}'),
            EnvConfig::create('DATABASE_URL', 'postgres://localhost:5432/${db_name}'),
            EnvConfig::create('STATIC_VALUE', 'unchanged'),
        ];
        $stdioConfig->setEnv($env);

        $result = $stdioConfig->replaceRequiredFields([
            'user_id' => '12345',
            'api_token' => 'secret123',
            'api_key' => 'sk-1234567890',
            'db_name' => 'production_db',
        ]);

        $this->assertSame($stdioConfig, $result); // Same instance returned
        $this->assertEquals('npx', $stdioConfig->getCommand());
        $this->assertEquals(['script.py', '--param', '12345', '--token', 'secret123'], $stdioConfig->getArguments());

        // Test env replacement through getEnvArray
        $envArray = $stdioConfig->getEnvArray();
        $this->assertEquals('sk-1234567890', $envArray['API_KEY']);
        $this->assertEquals('postgres://localhost:5432/production_db', $envArray['DATABASE_URL']);
        $this->assertEquals('unchanged', $envArray['STATIC_VALUE']);

        // Test SSEServiceConfig
        $sseConfig = new SSEServiceConfig();
        $header = HeaderConfig::fromArray([
            'key' => 'Authorization',
            'value' => 'Bearer ${access_token}',
            'mapper_system_input' => 'original_system_input',
        ]);
        $sseConfig->setHeaders([$header]);

        $result = $sseConfig->replaceRequiredFields([
            'access_token' => 'token123',
        ]);

        $this->assertSame($sseConfig, $result); // Same instance returned
        $headers = $sseConfig->getHeaders();
        $this->assertCount(1, $headers);
        $this->assertEquals('Authorization', $headers[0]->getKey());
        $this->assertEquals('Bearer token123', $headers[0]->getValue());
        $this->assertEquals('original_system_input', $headers[0]->getMapperSystemInput()); // mapper_system_input is not replaced

        // Test ExternalSSEServiceConfig
        $externalSSEConfig = new ExternalSSEServiceConfig();
        $externalSSEConfig->setUrl('https://api.github.com/sse/user/${user_id}?key=${api_key}&limit=10');
        $externalSSEConfig->setAuthType(ServiceConfigAuthType::NONE);

        $header = HeaderConfig::fromArray([
            'key' => 'X-Custom-Header',
            'value' => '${custom_value}',
            'mapper_system_input' => 'fixed_system_input',
        ]);
        $externalSSEConfig->setHeaders([$header]);

        $result = $externalSSEConfig->replaceRequiredFields([
            'user_id' => '67890',
            'api_key' => 'mykey456',
            'custom_value' => 'custom123',
        ]);

        $this->assertSame($externalSSEConfig, $result); // Same instance returned
        $this->assertEquals('https://api.github.com/sse/user/67890?key=mykey456&limit=10', $externalSSEConfig->getUrl());
        $this->assertEquals(ServiceConfigAuthType::NONE, $externalSSEConfig->getAuthType());

        $headers = $externalSSEConfig->getHeaders();
        $this->assertCount(1, $headers);
        $this->assertEquals('X-Custom-Header', $headers[0]->getKey());
        $this->assertEquals('custom123', $headers[0]->getValue());
        $this->assertEquals('fixed_system_input', $headers[0]->getMapperSystemInput()); // mapper_system_input is not replaced
    }

    public function testReplaceRequiredFieldsDoesNotReplaceDomain()
    {
        // Test that domain variables are NOT replaced
        $config = new ExternalSSEServiceConfig();
        $config->setUrl('https://${domain}.api.com/sse/user/${user_id}?key=${api_key}');
        $config->setAuthType(ServiceConfigAuthType::NONE);

        $result = $config->replaceRequiredFields([
            'domain' => 'replaced', // This should NOT be replaced
            'user_id' => '12345',
            'api_key' => 'secret123',
        ]);

        // Should return the same instance
        $this->assertSame($config, $result);

        // Domain should remain unchanged, but path and query should be replaced
        $this->assertEquals('https://${domain}.api.com/sse/user/12345?key=secret123', $config->getUrl());
    }

    public function testReplaceRequiredFieldsWithDefaultValues()
    {
        // Test ExternalSSEServiceConfig with default values
        $config = new ExternalSSEServiceConfig();
        $config->setUrl('https://api.github.com/sse/user/${user_id|12345}?key=${api_key}&timeout=${timeout|30}');
        $config->setAuthType(ServiceConfigAuthType::NONE);

        $header = HeaderConfig::fromArray([
            'key' => 'Authorization',
            'value' => 'Bearer ${access_token|default_token}',
            'mapper_system_input' => 'system_input',
        ]);
        $config->setHeaders([$header]);

        // Test 1: Provide some values, use defaults for others
        $result = $config->replaceRequiredFields([
            'api_key' => 'provided_key',
            // user_id not provided - should use default "12345"
            // access_token not provided - should use default "default_token"
            // timeout not provided - should use default "30"
        ]);

        $this->assertSame($config, $result);
        $this->assertEquals('https://api.github.com/sse/user/12345?key=provided_key&timeout=30', $config->getUrl());
        $this->assertEquals('Bearer default_token', $config->getHeaders()[0]->getValue());

        // Test 2: Override some default values
        $config->setUrl('https://api.github.com/sse/user/${user_id|12345}?key=${api_key}&timeout=${timeout|30}');
        $config->getHeaders()[0]->setValue('Bearer ${access_token|default_token}');

        $config->replaceRequiredFields([
            'user_id' => '67890', // Override default
            'api_key' => 'new_key',
            'timeout' => '60', // Override default
            // access_token not provided - should use default
        ]);

        $this->assertEquals('https://api.github.com/sse/user/67890?key=new_key&timeout=60', $config->getUrl());
        $this->assertEquals('Bearer default_token', $config->getHeaders()[0]->getValue());
    }

    public function testReplaceRequiredFieldsWithoutDefaultValues()
    {
        // Test fields without default values become empty string when not provided
        $config = new ExternalSSEServiceConfig();
        $config->setUrl('https://api.github.com/sse/user/${user_id}?key=${api_key|default_key}');
        $config->setAuthType(ServiceConfigAuthType::NONE);

        $config->replaceRequiredFields([
            // user_id not provided and has no default - should become empty string
            // api_key not provided but has default - should use default
        ]);

        $this->assertEquals('https://api.github.com/sse/user/?key=default_key', $config->getUrl());
    }

    public function testGetRequireFieldsWithDefaultValues()
    {
        // Test that getRequireFields returns field names without default values
        $config = new ExternalSSEServiceConfig();
        $config->setUrl('https://api.github.com/sse/user/${user_id|12345}?key=${api_key}&timeout=${timeout|30}');

        $header = HeaderConfig::fromArray([
            'key' => 'Authorization',
            'value' => 'Bearer ${access_token|default_token}',
            'mapper_system_input' => '',
        ]);
        $config->setHeaders([$header]);

        $requiredFields = $config->getRequireFields();

        // Should extract field names without default values
        $expectedFields = ['user_id', 'api_key', 'timeout', 'access_token'];

        foreach ($expectedFields as $field) {
            $this->assertContains($field, $requiredFields, "Missing required field: {$field}");
        }

        $this->assertEquals(4, count($requiredFields));
    }

    public function testDefaultValuesWithSpecialCharacters()
    {
        // Test default values containing special characters
        $config = new ExternalStdioServiceConfig();
        $config->setCommand('npx');
        $config->setArguments([
            'script.py',
            '--param=${param|value with spaces}',
            '--url=${url|https://example.com/path?query=value}',
            '--data=${data|{"key":"value","number":123}}',
        ]);

        $config->replaceRequiredFields([
            'param' => 'overridden_param',
            // url and data not provided - should use defaults
        ]);

        $expectedArgs = [
            'script.py',
            '--param=overridden_param',
            '--url=https://example.com/path?query=value',
            '--data={"key":"value","number":123}',
        ];

        $this->assertEquals($expectedArgs, $config->getArguments());
    }

    public function testReplaceRequiredFieldsWithEmptyStringForMissingFields()
    {
        // Test that fields without default values are replaced with empty string

        // Test ExternalStdioServiceConfig
        $stdioConfig = new ExternalStdioServiceConfig();
        $stdioConfig->setCommand('npx');
        $stdioConfig->setArguments([
            'script.py',
            '--param=${param}', // No default value
            '--value=${value|default_value}', // Has default value
            '--empty=${empty}', // No default value
        ]);

        $stdioConfig->replaceRequiredFields([
            'param' => 'provided_param',
            // value not provided - should use default
            // empty not provided - should become empty string
        ]);

        $expectedArgs = [
            'script.py',
            '--param=provided_param',
            '--value=default_value',
            '--empty=',
        ];

        $this->assertEquals($expectedArgs, $stdioConfig->getArguments());

        // Test SSEServiceConfig
        $sseConfig = new SSEServiceConfig();
        $header = HeaderConfig::fromArray([
            'key' => 'Authorization',
            'value' => 'Bearer ${token} ${extra}', // Both without default values
            'mapper_system_input' => 'system',
        ]);
        $sseConfig->setHeaders([$header]);

        $sseConfig->replaceRequiredFields([
            'token' => 'abc123',
            // extra not provided - should become empty string
        ]);

        $this->assertEquals('Bearer abc123 ', $sseConfig->getHeaders()[0]->getValue());

        // Test ExternalSSEServiceConfig
        $externalConfig = new ExternalSSEServiceConfig();
        $externalConfig->setUrl('https://api.example.com/user/${user_id}/data/${data_id}?key=${api_key|default_key}');
        $externalConfig->setAuthType(ServiceConfigAuthType::NONE);

        $externalConfig->replaceRequiredFields([
            'user_id' => '123',
            // data_id not provided - should become empty string
            // api_key not provided - should use default
        ]);

        $this->assertEquals('https://api.example.com/user/123/data/?key=default_key', $externalConfig->getUrl());
    }
}
