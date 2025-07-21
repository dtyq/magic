<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\MCP;

use App\Domain\MCP\Entity\ValueObject\OAuth2AuthResult;
use DateTime;
use DateTimeInterface;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class OAuth2AuthResultTest extends TestCase
{
    public function testConstructorSetsAllProperties()
    {
        $accessToken = 'access_token_123';
        $refreshToken = 'refresh_token_456';
        $expiresAt = new DateTime('+1 hour');
        $tokenType = 'Custom';
        $scope = 'read write';

        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken($accessToken)
            ->setRefreshToken($refreshToken)
            ->setExpiresAt($expiresAt)
            ->setTokenType($tokenType)
            ->setScope($scope);

        $this->assertEquals($accessToken, $authResult->getAccessToken());
        $this->assertEquals($refreshToken, $authResult->getRefreshToken());
        $this->assertEquals($expiresAt, $authResult->getExpiresAt());
        $this->assertEquals($tokenType, $authResult->getTokenType());
        $this->assertEquals($scope, $authResult->getScope());
    }

    public function testConstructorWithMinimalParameters()
    {
        $accessToken = 'access_token_123';
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken($accessToken);

        $this->assertEquals($accessToken, $authResult->getAccessToken());
        $this->assertNull($authResult->getRefreshToken());
        $this->assertNull($authResult->getExpiresAt());
        $this->assertEquals('Bearer', $authResult->getTokenType());
        $this->assertNull($authResult->getScope());
    }

    public function testIsExpiredReturnsFalseWhenNoExpirationSet()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token');
        $this->assertFalse($authResult->isExpired());
    }

    public function testIsExpiredReturnsTrueWhenExpired()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token');
        $authResult->setExpiresAt(new DateTime('-1 minute')); // Expired 1 minute ago
        $this->assertTrue($authResult->isExpired());
    }

    public function testIsExpiredReturnsFalseWhenNotExpired()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token');
        $authResult->setExpiresAt(new DateTime('+1 minute')); // Expires in 1 minute
        $this->assertFalse($authResult->isExpired());
    }

    public function testWillExpireWithinReturnsFalseWhenNoExpirationSet()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token');
        $this->assertFalse($authResult->willExpireWithin(300));
    }

    public function testWillExpireWithinReturnsTrueWhenWillExpireSoon()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token')
            ->setExpiresAt(new DateTime('+2 minutes')); // Expires in 2 minutes
        $this->assertTrue($authResult->willExpireWithin(300)); // Check 5 minutes
    }

    public function testWillExpireWithinReturnsFalseWhenWillNotExpireSoon()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token')
            ->setExpiresAt(new DateTime('+10 minutes')); // Expires in 10 minutes
        $this->assertFalse($authResult->willExpireWithin(300)); // Check 5 minutes
    }

    public function testGetRemainingSecondsReturnsNullWhenNoExpirationSet()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token');
        $this->assertNull($authResult->getRemainingSeconds());
    }

    public function testGetRemainingSecondsReturnsCorrectValue()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token')
            ->setExpiresAt(new DateTime('+5 minutes')); // Expires in 5 minutes
        $remaining = $authResult->getRemainingSeconds();
        $this->assertIsInt($remaining);
        $this->assertGreaterThan(290, $remaining); // Should be around 300 seconds
        $this->assertLessThan(310, $remaining);
    }

    public function testGetRemainingSecondsReturnsZeroWhenExpired()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token')
            ->setExpiresAt(new DateTime('-1 minute')); // Expired 1 minute ago
        $this->assertEquals(0, $authResult->getRemainingSeconds());
    }

    public function testWithAccessTokenCreatesNewInstance()
    {
        $original = new OAuth2AuthResult();
        $original->setAccessToken('original_token');
        $updated = $original->withAccessToken('updated_token', 3600);

        $this->assertEquals('original_token', $original->getAccessToken());
        $this->assertEquals('updated_token', $updated->getAccessToken());
        $this->assertNotSame($original, $updated);
    }

    public function testWithAccessTokenWithExpiresIn()
    {
        $original = new OAuth2AuthResult();
        $original->setAccessToken('original_token');
        $updated = $original->withAccessToken('updated_token', 3600);

        $this->assertNotNull($updated->getExpiresAt());
        $this->assertTrue($updated->getExpiresAt() > new DateTime());
    }

    public function testWithRefreshTokenCreatesNewInstance()
    {
        $original = new OAuth2AuthResult();
        $original->setAccessToken('access_token')
            ->setRefreshToken('original_refresh');
        $updated = $original->withRefreshToken('updated_refresh');

        $this->assertEquals('original_refresh', $original->getRefreshToken());
        $this->assertEquals('updated_refresh', $updated->getRefreshToken());
        $this->assertNotSame($original, $updated);
    }

    public function testToArrayReturnsCorrectStructure()
    {
        $expiresAt = new DateTime('+1 hour');
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token')
            ->setRefreshToken('refresh_token')
            ->setExpiresAt($expiresAt)
            ->setTokenType('Bearer')
            ->setScope('read write');

        $array = $authResult->toArray();

        $this->assertArrayHasKey('access_token', $array);
        $this->assertArrayHasKey('refresh_token', $array);
        $this->assertArrayHasKey('expires_at', $array);
        $this->assertArrayHasKey('token_type', $array);
        $this->assertArrayHasKey('scope', $array);

        $this->assertEquals('access_token', $array['access_token']);
        $this->assertEquals('refresh_token', $array['refresh_token']);
        $this->assertEquals($expiresAt->format(DateTimeInterface::ATOM), $array['expires_at']);
        $this->assertEquals('Bearer', $array['token_type']);
        $this->assertEquals('read write', $array['scope']);
    }

    public function testToArrayWithNullValues()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token');
        $array = $authResult->toArray();

        $this->assertNull($array['refresh_token']);
        $this->assertNull($array['expires_at']);
        $this->assertNull($array['scope']);
    }

    public function testFromArrayRestoresObject()
    {
        $data = [
            'access_token' => 'test_access_token',
            'refresh_token' => 'test_refresh_token',
            'expires_at' => (new DateTime('+1 hour'))->format(DateTimeInterface::ATOM),
            'token_type' => 'Bearer',
            'scope' => 'read write',
        ];

        $authResult = OAuth2AuthResult::fromArray($data);

        $this->assertEquals('test_access_token', $authResult->getAccessToken());
        $this->assertEquals('test_refresh_token', $authResult->getRefreshToken());
        $this->assertEquals('Bearer', $authResult->getTokenType());
        $this->assertEquals('read write', $authResult->getScope());
        $this->assertNotNull($authResult->getExpiresAt());
    }

    public function testFromArrayWithEmptyData()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('access_token is required');

        OAuth2AuthResult::fromArray([]);
    }

    public function testFromOAuth2ResponseWithCompleteData()
    {
        $response = [
            'access_token' => 'oauth_access_token',
            'refresh_token' => 'oauth_refresh_token',
            'expires_in' => 3600,
            'token_type' => 'Bearer',
            'scope' => 'read write delete',
        ];

        $authResult = OAuth2AuthResult::fromOAuth2Response($response);

        $this->assertEquals('oauth_access_token', $authResult->getAccessToken());
        $this->assertEquals('oauth_refresh_token', $authResult->getRefreshToken());
        $this->assertEquals('Bearer', $authResult->getTokenType());
        $this->assertEquals('read write delete', $authResult->getScope());
        $this->assertNotNull($authResult->getExpiresAt());
        $this->assertTrue($authResult->getExpiresAt() > new DateTime());
    }

    public function testFromOAuth2ResponseWithMinimalData()
    {
        $response = [
            'access_token' => 'oauth_access_token',
        ];

        $authResult = OAuth2AuthResult::fromOAuth2Response($response);

        $this->assertEquals('oauth_access_token', $authResult->getAccessToken());
        $this->assertNull($authResult->getRefreshToken());
        $this->assertNull($authResult->getExpiresAt());
        $this->assertEquals('Bearer', $authResult->getTokenType());
        $this->assertNull($authResult->getScope());
    }

    public function testGetAuthorizationHeaderReturnsCorrectFormat()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('test_token')
            ->setTokenType('Bearer');
        $this->assertEquals('Bearer test_token', $authResult->getAuthorizationHeader());
    }

    public function testGetAuthorizationHeaderWithCustomTokenType()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('test_token')
            ->setTokenType('Custom');
        $this->assertEquals('Custom test_token', $authResult->getAuthorizationHeader());
    }

    public function testHasRefreshTokenReturnsTrueWhenPresent()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token')
            ->setRefreshToken('refresh_token');
        $this->assertTrue($authResult->hasRefreshToken());
    }

    public function testHasRefreshTokenReturnsFalseWhenNotPresent()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token');
        $this->assertFalse($authResult->hasRefreshToken());
    }

    public function testHasRefreshTokenReturnsFalseWhenEmpty()
    {
        $authResult = new OAuth2AuthResult();
        $authResult->setAccessToken('access_token')
            ->setRefreshToken('');
        $this->assertFalse($authResult->hasRefreshToken());
    }

    public function testRoundTripSerializationPreservesData()
    {
        $original = new OAuth2AuthResult();
        $original->setAccessToken('access_token_123')
            ->setRefreshToken('refresh_token_456')
            ->setExpiresAt(new DateTime('+1 hour'))
            ->setTokenType('Bearer')
            ->setScope('read write');

        $array = $original->toArray();
        $restored = OAuth2AuthResult::fromArray($array);

        $this->assertEquals($original->getAccessToken(), $restored->getAccessToken());
        $this->assertEquals($original->getRefreshToken(), $restored->getRefreshToken());
        $this->assertEquals($original->getTokenType(), $restored->getTokenType());
        $this->assertEquals($original->getScope(), $restored->getScope());
        $this->assertEquals($original->getExpiresAt()->format(DateTimeInterface::ATOM), $restored->getExpiresAt()->format(DateTimeInterface::ATOM));
    }

    public function testFromFormArrayWithStandardFields()
    {
        $formData = [
            'access_token' => 'form_access_token',
            'refresh_token' => 'form_refresh_token',
            'expires_in' => 3600,
            'token_type' => 'Bearer',
            'scope' => 'read write delete',
        ];

        $authResult = OAuth2AuthResult::fromFormArray($formData);

        $this->assertEquals('form_access_token', $authResult->getAccessToken());
        $this->assertEquals('form_refresh_token', $authResult->getRefreshToken());
        $this->assertEquals('Bearer', $authResult->getTokenType());
        $this->assertEquals('read write delete', $authResult->getScope());
        $this->assertNotNull($authResult->getExpiresAt());
        $this->assertTrue($authResult->getExpiresAt() > new DateTime());
    }

    public function testFromFormArrayWithCamelCaseFields()
    {
        $formData = [
            'accessToken' => 'camel_access_token',
            'refreshToken' => 'camel_refresh_token',
            'expiresIn' => 1800,
            'tokenType' => 'Custom',
            'scope' => 'admin user',
        ];

        $authResult = OAuth2AuthResult::fromFormArray($formData);

        $this->assertEquals('camel_access_token', $authResult->getAccessToken());
        $this->assertEquals('camel_refresh_token', $authResult->getRefreshToken());
        $this->assertEquals('Custom', $authResult->getTokenType());
        $this->assertEquals('admin user', $authResult->getScope());
        $this->assertNotNull($authResult->getExpiresAt());
    }

    public function testFromFormArrayWithAlternativeTokenField()
    {
        $formData = [
            'token' => 'alternative_token',
            'scope' => 'basic',
        ];

        $authResult = OAuth2AuthResult::fromFormArray($formData);

        $this->assertEquals('alternative_token', $authResult->getAccessToken());
        $this->assertEquals('Bearer', $authResult->getTokenType()); // Default value
        $this->assertEquals('basic', $authResult->getScope());
        $this->assertNull($authResult->getRefreshToken());
        $this->assertNull($authResult->getExpiresAt());
    }

    public function testFromFormArrayWithScopeArray()
    {
        $formData = [
            'access_token' => 'scope_test_token',
            'scope' => ['read', 'write', 'admin'],
        ];

        $authResult = OAuth2AuthResult::fromFormArray($formData);

        $this->assertEquals('scope_test_token', $authResult->getAccessToken());
        $this->assertEquals('read write admin', $authResult->getScope());
    }

    public function testFromFormArrayWithDateTimeString()
    {
        $expiresAt = (new DateTime('+2 hours'))->format(DateTimeInterface::ATOM);
        $formData = [
            'access_token' => 'datetime_test_token',
            'expires_at' => $expiresAt,
        ];

        $authResult = OAuth2AuthResult::fromFormArray($formData);

        $this->assertEquals('datetime_test_token', $authResult->getAccessToken());
        $this->assertNotNull($authResult->getExpiresAt());
        $this->assertEquals($expiresAt, $authResult->getExpiresAt()->format(DateTimeInterface::ATOM));
    }

    public function testFromFormArrayWithMissingAccessTokenThrowsException()
    {
        $formData = [
            'refresh_token' => 'only_refresh_token',
            'scope' => 'test',
        ];

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('access_token is required in form data');

        OAuth2AuthResult::fromFormArray($formData);
    }

    public function testFromFormArrayWithInvalidDateTimeThrowsException()
    {
        $formData = [
            'access_token' => 'test_token',
            'expires_at' => 'invalid-datetime-string',
        ];

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid expires_at format');

        OAuth2AuthResult::fromFormArray($formData);
    }

    public function testFromFormArrayWithMinimalData()
    {
        $formData = [
            'access_token' => 'minimal_token',
        ];

        $authResult = OAuth2AuthResult::fromFormArray($formData);

        $this->assertEquals('minimal_token', $authResult->getAccessToken());
        $this->assertEquals('Bearer', $authResult->getTokenType());
        $this->assertNull($authResult->getRefreshToken());
        $this->assertNull($authResult->getExpiresAt());
        $this->assertNull($authResult->getScope());
    }
}
