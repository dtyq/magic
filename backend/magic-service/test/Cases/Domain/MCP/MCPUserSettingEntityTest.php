<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\MCP;

use App\Domain\MCP\Entity\MCPUserSettingEntity;
use App\Domain\MCP\Entity\ValueObject\OAuth2AuthResult;
use Carbon\Carbon;
use DateTime;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class MCPUserSettingEntityTest extends TestCase
{
    public function testConstructorInitializesEmptyArrays()
    {
        $entity = new MCPUserSettingEntity();

        $this->assertEquals([], $entity->getRequireFields());
        $this->assertEquals([], $entity->getAdditionalConfig());
        $this->assertNull($entity->getOauth2AuthResult());
    }

    public function testBasicPropertiesSettersAndGetters()
    {
        $entity = new MCPUserSettingEntity();

        $entity->setId(123);
        $entity->setOrganizationCode('ORG001');
        $entity->setUserId('user123');
        $entity->setMcpServerId('server456');

        $this->assertEquals(123, $entity->getId());
        $this->assertEquals('ORG001', $entity->getOrganizationCode());
        $this->assertEquals('user123', $entity->getUserId());
        $this->assertEquals('server456', $entity->getMcpServerId());
    }

    public function testRequireFieldsManagement()
    {
        $entity = new MCPUserSettingEntity();

        // Test setRequireFields
        $fields = ['api_key' => 'test_key', 'endpoint' => 'test_endpoint'];
        $entity->setRequireFields($fields);
        $this->assertEquals($fields, $entity->getRequireFields());

        // Test setRequireField
        $entity->setRequireField('new_field', 'new_value');
        $this->assertEquals('new_value', $entity->getRequireField('new_field'));

        // Test getRequireField for non-existent field
        $this->assertNull($entity->getRequireField('non_existent'));

        // Test removeRequireField
        $entity->removeRequireField('api_key');
        $this->assertNull($entity->getRequireField('api_key'));
        $this->assertEquals('test_endpoint', $entity->getRequireField('endpoint'));
    }

    public function testOAuth2AuthResultManagement()
    {
        $entity = new MCPUserSettingEntity();

        // Test setOauth2AuthResult
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token_123')
            ->setRefreshToken('refresh_token_456')
            ->setExpiresAt(new DateTime('+1 hour'))
            ->setTokenType('Bearer')
            ->setScope('read write');

        $entity->setOauth2AuthResult($authResult);
        $this->assertSame($authResult, $entity->getOauth2AuthResult());

        // Test convenience methods
        $this->assertEquals('access_token_123', $entity->getOauth2AccessToken());
        $this->assertEquals('refresh_token_456', $entity->getOauth2RefreshToken());
        $this->assertFalse($entity->isOauth2TokenExpired());
        $this->assertEquals('Bearer access_token_123', $entity->getOauth2AuthorizationHeader());
        $this->assertTrue($entity->hasOauth2RefreshToken());

        // Test with null OAuth2AuthResult
        $entity->setOauth2AuthResult(null);
        $this->assertNull($entity->getOauth2AuthResult());
        $this->assertNull($entity->getOauth2AccessToken());
        $this->assertNull($entity->getOauth2RefreshToken());
        $this->assertFalse($entity->isOauth2TokenExpired());
        $this->assertNull($entity->getOauth2AuthorizationHeader());
        $this->assertFalse($entity->hasOauth2RefreshToken());
    }

    public function testSetOauth2TokensFromResponse()
    {
        $entity = new MCPUserSettingEntity();

        $response = [
            'access_token' => 'response_access_token',
            'refresh_token' => 'response_refresh_token',
            'expires_in' => 3600,
            'token_type' => 'Bearer',
            'scope' => 'read write delete',
        ];

        $entity->setOauth2TokensFromResponse($response);

        $this->assertEquals('response_access_token', $entity->getOauth2AccessToken());
        $this->assertEquals('response_refresh_token', $entity->getOauth2RefreshToken());
        $this->assertNotNull($entity->getOauth2AuthResult());
        $this->assertFalse($entity->isOauth2TokenExpired());
    }

    public function testWillOauth2TokenExpireWithin()
    {
        $entity = new MCPUserSettingEntity();

        // Test with no auth result
        $this->assertFalse($entity->willOauth2TokenExpireWithin(300));

        // Test with auth result that will expire soon
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token')
            ->setExpiresAt(new DateTime('+2 minutes')); // Expires in 2 minutes
        $entity->setOauth2AuthResult($authResult);

        $this->assertTrue($entity->willOauth2TokenExpireWithin(300)); // Check 5 minutes
        $this->assertFalse($entity->willOauth2TokenExpireWithin(60)); // Check 1 minute
    }

    public function testAdditionalConfigManagement()
    {
        $entity = new MCPUserSettingEntity();

        // Test setAdditionalConfig
        $config = ['key1' => 'value1', 'key2' => 'value2'];
        $entity->setAdditionalConfig($config);
        $this->assertEquals($config, $entity->getAdditionalConfig());

        // Test setAdditionalConfigValue
        $entity->setAdditionalConfigValue('key3', 'value3');
        $this->assertEquals('value3', $entity->getAdditionalConfigValue('key3'));

        // Test getAdditionalConfigValue for non-existent key
        $this->assertNull($entity->getAdditionalConfigValue('non_existent'));
    }

    public function testTimestampProperties()
    {
        $entity = new MCPUserSettingEntity();

        $createdAt = Carbon::now()->subHour();
        $updatedAt = Carbon::now();

        $entity->setCreatedAt($createdAt);
        $entity->setUpdatedAt($updatedAt);

        $this->assertEquals($createdAt, $entity->getCreatedAt());
        $this->assertEquals($updatedAt, $entity->getUpdatedAt());
    }

    public function testHasConfiguration()
    {
        $entity = new MCPUserSettingEntity();

        // Initially no configuration
        $this->assertFalse($entity->hasConfiguration());

        // With require fields
        $entity->setRequireField('api_key', 'test_key');
        $this->assertTrue($entity->hasConfiguration());

        // Clear and test with OAuth2
        $entity->setRequireFields([]);
        $this->assertFalse($entity->hasConfiguration());

        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token');
        $entity->setOauth2AuthResult($authResult);
        $this->assertTrue($entity->hasConfiguration());

        // Clear and test with additional config
        $entity->setOauth2AuthResult(null);
        $this->assertFalse($entity->hasConfiguration());

        $entity->setAdditionalConfigValue('test_key', 'test_value');
        $this->assertTrue($entity->hasConfiguration());
    }

    public function testClearConfiguration()
    {
        $entity = new MCPUserSettingEntity();

        // Set up configuration
        $entity->setRequireFields(['api_key' => 'test_key']);
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token');
        $entity->setOauth2AuthResult($authResult);
        $entity->setAdditionalConfig(['config_key' => 'config_value']);

        $this->assertTrue($entity->hasConfiguration());

        // Clear configuration
        $entity->clearConfiguration();

        $this->assertFalse($entity->hasConfiguration());
        $this->assertEquals([], $entity->getRequireFields());
        $this->assertNull($entity->getOauth2AuthResult());
        $this->assertEquals([], $entity->getAdditionalConfig());
    }

    public function testToArray()
    {
        $entity = new MCPUserSettingEntity();
        $entity->setId(123);
        $entity->setOrganizationCode('ORG001');
        $entity->setUserId('user123');
        $entity->setMcpServerId('server456');
        $entity->setRequireFields(['api_key' => 'test_key']);
        $entity->setAdditionalConfig(['config_key' => 'config_value']);
        $entity->setCreator('test_creator');
        $entity->setModifier('test_modifier');

        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token')
            ->setRefreshToken('refresh_token');
        $entity->setOauth2AuthResult($authResult);

        $entity->prepareForCreation();

        $array = $entity->toArray();

        $this->assertArrayHasKey('id', $array);
        $this->assertArrayHasKey('organization_code', $array);
        $this->assertArrayHasKey('user_id', $array);
        $this->assertArrayHasKey('mcp_server_id', $array);
        $this->assertArrayHasKey('require_fields', $array);
        $this->assertArrayHasKey('oauth2_auth_result', $array);
        $this->assertArrayHasKey('additional_config', $array);
        $this->assertArrayHasKey('creator', $array);
        $this->assertArrayHasKey('created_at', $array);
        $this->assertArrayHasKey('modifier', $array);
        $this->assertArrayHasKey('updated_at', $array);

        $this->assertEquals(123, $array['id']);
        $this->assertEquals('ORG001', $array['organization_code']);
        $this->assertEquals('user123', $array['user_id']);
        $this->assertEquals('server456', $array['mcp_server_id']);
        $this->assertEquals(['api_key' => 'test_key'], $array['require_fields']);
        $this->assertEquals(['config_key' => 'config_value'], $array['additional_config']);
        $this->assertEquals('test_creator', $array['creator']);
        $this->assertEquals('test_modifier', $array['modifier']);
        $this->assertNotNull($array['oauth2_auth_result']);
        $this->assertIsString($array['created_at']);
        $this->assertIsString($array['updated_at']);
    }

    public function testToArrayWithNullOAuth2AuthResult()
    {
        $entity = new MCPUserSettingEntity();
        $entity->setOrganizationCode('ORG001');
        $entity->setUserId('user123');
        $entity->setMcpServerId('server456');
        $entity->setCreator('test_creator');
        $entity->setModifier('test_modifier');
        $entity->prepareForCreation();

        $array = $entity->toArray();

        $this->assertNull($array['oauth2_auth_result']);
    }

    public function testPrepareForCreationSetsTimestamps()
    {
        $entity = new MCPUserSettingEntity();

        // Check timestamps are not set initially by calling prepareForCreation
        $entity->prepareForCreation();

        $this->assertNotNull($entity->getCreatedAt());
        $this->assertNotNull($entity->getUpdatedAt());
        $this->assertEquals(date('Y-m-d'), $entity->getCreatedAt()->format('Y-m-d'));
        $this->assertEquals(date('Y-m-d'), $entity->getUpdatedAt()->format('Y-m-d'));
    }

    public function testPrepareForCreationPreservesExistingTimestamps()
    {
        $entity = new MCPUserSettingEntity();

        $existingCreatedAt = Carbon::now()->subDays(2);
        $existingUpdatedAt = Carbon::now()->subHour();

        $entity->setCreatedAt($existingCreatedAt);
        $entity->setUpdatedAt($existingUpdatedAt);

        $entity->prepareForCreation();

        $this->assertEquals($existingCreatedAt, $entity->getCreatedAt());
        $this->assertEquals($existingUpdatedAt, $entity->getUpdatedAt());
    }

    public function testModificationDoesNotUpdateTimestamp()
    {
        $entity = new MCPUserSettingEntity();
        $entity->prepareForCreation();

        $initialUpdatedAt = $entity->getUpdatedAt();

        // Sleep to ensure timestamp difference
        sleep(1);

        // Modify entity - timestamp should NOT automatically update
        $entity->setRequireField('test_field', 'test_value');

        $this->assertEquals($initialUpdatedAt, $entity->getUpdatedAt());
    }

    public function testManualTimestampUpdate()
    {
        $entity = new MCPUserSettingEntity();
        $entity->prepareForCreation();

        $initialUpdatedAt = $entity->getUpdatedAt();

        // Sleep to ensure timestamp difference
        sleep(1);

        // Manually update timestamp
        $entity->setUpdatedAt(new DateTime());

        $this->assertTrue($entity->getUpdatedAt() > $initialUpdatedAt);
    }
}
