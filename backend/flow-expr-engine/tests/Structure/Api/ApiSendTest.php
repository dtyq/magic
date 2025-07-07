<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Test\Structure\Api;

use Dtyq\FlowExprEngine\Structure\Api\ApiRequestBodyType;
use Dtyq\FlowExprEngine\Structure\Api\ApiRequestOptions;
use Dtyq\FlowExprEngine\Structure\Api\ApiSend;
use Dtyq\FlowExprEngine\Structure\Api\Safe\DefenseAgainstSSRFOptions;
use Dtyq\FlowExprEngine\Test\BaseTestCase;
use Error;

/**
 * @internal
 * @coversNothing
 */
class ApiSendTest extends BaseTestCase
{
    public function testConstructor(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('GET');
        $apiRequestOptions->setUri('https://api.example.com/users');

        $apiSend = new ApiSend($apiRequestOptions);
        $this->assertInstanceOf(ApiSend::class, $apiSend);
    }

    public function testConstructorWithTimeout(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('GET');
        $apiRequestOptions->setUri('https://api.example.com/users');

        $apiSend = new ApiSend($apiRequestOptions, 10);
        $this->assertInstanceOf(ApiSend::class, $apiSend);
    }

    public function testConstructorWithDefenseAgainstSSRF(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('GET');
        $apiRequestOptions->setUri('https://api.example.com/users');

        $defenseOptions = new DefenseAgainstSSRFOptions();
        $apiSend = new ApiSend($apiRequestOptions, 5, $defenseOptions);
        $this->assertInstanceOf(ApiSend::class, $apiSend);
    }

    public function testGettersInitiallyNull(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('GET');
        $apiRequestOptions->setUri('https://api.example.com/users');

        $apiSend = new ApiSend($apiRequestOptions);

        $this->assertNull($apiSend->getRequest());
        $this->assertNull($apiSend->getResponse());
        $this->assertNull($apiSend->getElapsedTime());
    }

    public function testSetTimeout(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('GET');
        $apiRequestOptions->setUri('https://api.example.com/users');

        $apiSend = new ApiSend($apiRequestOptions);
        $apiSend->setTimeout(30);
        // No getter for timeout, so we can't directly verify it
        $this->assertInstanceOf(ApiSend::class, $apiSend);
    }

    public function testApiRequestOptionsWithGetMethod(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('GET');
        $apiRequestOptions->setUri('https://api.example.com/users');
        $apiRequestOptions->addParamsQuery(['limit' => 10, 'page' => 1]);
        $apiRequestOptions->addHeaders(['Authorization' => 'Bearer token123']);

        $apiSend = new ApiSend($apiRequestOptions);
        $this->assertInstanceOf(ApiSend::class, $apiSend);
    }

    public function testApiRequestOptionsWithPostMethod(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('POST');
        $apiRequestOptions->setUri('https://api.example.com/users');
        $apiRequestOptions->addBody(['name' => 'John Doe', 'email' => 'john@example.com']);
        $apiRequestOptions->addHeaders(['Content-Type' => 'application/json']);
        $apiRequestOptions->setApiRequestBodyType(ApiRequestBodyType::Json);

        $apiSend = new ApiSend($apiRequestOptions);
        $this->assertInstanceOf(ApiSend::class, $apiSend);
    }

    public function testApiRequestOptionsWithProxy(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('GET');
        $apiRequestOptions->setUri('https://api.example.com/users');
        $apiRequestOptions->setProxy('proxy.example.com:8080');

        $apiSend = new ApiSend($apiRequestOptions);
        $this->assertInstanceOf(ApiSend::class, $apiSend);
    }

    public function testApiRequestOptionsWithFormData(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('POST');
        $apiRequestOptions->setUri('https://api.example.com/users');
        $apiRequestOptions->addBody(['name' => 'John', 'email' => 'john@example.com']);
        $apiRequestOptions->addHeaders(['Content-Type' => 'application/x-www-form-urlencoded']);
        $apiRequestOptions->setApiRequestBodyType(ApiRequestBodyType::XWwwFormUrlencoded);

        $apiSend = new ApiSend($apiRequestOptions);
        $this->assertInstanceOf(ApiSend::class, $apiSend);
    }

    public function testApiRequestOptionsWithMultipartFormData(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('POST');
        $apiRequestOptions->setUri('https://api.example.com/upload');
        $apiRequestOptions->addBody(['file' => 'data', 'title' => 'test']);
        $apiRequestOptions->setApiRequestBodyType(ApiRequestBodyType::FormData);

        $apiSend = new ApiSend($apiRequestOptions);
        $this->assertInstanceOf(ApiSend::class, $apiSend);
    }

    public function testApiRequestOptionsWithCustomHeaders(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('GET');
        $apiRequestOptions->setUri('https://api.example.com/users');
        $apiRequestOptions->addHeaders([
            'Authorization' => 'Bearer token123',
            'X-Custom-Header' => 'custom-value',
            'User-Agent' => 'FlowExprEngine/1.0',
        ]);

        $apiSend = new ApiSend($apiRequestOptions);
        $this->assertInstanceOf(ApiSend::class, $apiSend);
    }

    public function testApiRequestOptionsWithQueryAndPathParams(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('GET');
        $apiRequestOptions->setUri('https://api.example.com/users/{id}');
        $apiRequestOptions->addParamsQuery(['format' => 'json', 'fields' => 'name,email']);
        $apiRequestOptions->addParamsPath(['id' => '123']);

        $apiSend = new ApiSend($apiRequestOptions);
        $this->assertInstanceOf(ApiSend::class, $apiSend);
    }

    public function testApiRequestOptionsWithVerifyFalse(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('GET');
        $apiRequestOptions->setUri('https://api.example.com/users');
        $apiRequestOptions->setVerify(false);

        $apiSend = new ApiSend($apiRequestOptions);
        $this->assertInstanceOf(ApiSend::class, $apiSend);
    }

    public function testApiRequestOptionsWithAllHttpMethods(): void
    {
        $methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

        foreach ($methods as $method) {
            $apiRequestOptions = new ApiRequestOptions();
            $apiRequestOptions->setMethod($method);
            $apiRequestOptions->setUri('https://api.example.com/users');

            if (in_array($method, ['POST', 'PUT', 'PATCH'])) {
                $apiRequestOptions->addBody(['data' => 'test']);
                $apiRequestOptions->setApiRequestBodyType(ApiRequestBodyType::Json);
            }

            $apiSend = new ApiSend($apiRequestOptions);
            $this->assertInstanceOf(ApiSend::class, $apiSend);
        }
    }

    public function testShow(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('GET');
        $apiRequestOptions->setUri('https://api.example.com/users');

        $apiSend = new ApiSend($apiRequestOptions);
        $result = $apiSend->show();

        $this->assertIsArray($result);
        $this->assertArrayHasKey('elapsed_time', $result);
        $this->assertArrayHasKey('request', $result);
        $this->assertArrayHasKey('response', $result);
        $this->assertNull($result['elapsed_time']);
        $this->assertNull($result['request']);
        $this->assertNull($result['response']);
    }

    public function testGetResponseSourceData(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('GET');
        $apiRequestOptions->setUri('https://api.example.com/users');

        $apiSend = new ApiSend($apiRequestOptions);

        // This method will fail since there's no response yet, but we test the method exists
        $this->expectException(Error::class);
        $apiSend->getResponseSourceData('test-component');
    }

    public function testApiRequestOptionsGetters(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('POST');
        $apiRequestOptions->setUri('https://api.example.com/users');
        $apiRequestOptions->addBody(['name' => 'John', 'email' => 'john@example.com']);
        $apiRequestOptions->addHeaders(['Content-Type' => 'application/json']);
        $apiRequestOptions->addParamsQuery(['format' => 'json']);
        $apiRequestOptions->addParamsPath(['id' => '123']);
        $apiRequestOptions->setProxy('proxy.example.com:8080');
        $apiRequestOptions->setVerify(false);
        $apiRequestOptions->setApiRequestBodyType(ApiRequestBodyType::Json);

        $this->assertEquals('POST', $apiRequestOptions->getMethod());
        $this->assertEquals('https://api.example.com/users', $apiRequestOptions->getUri());
        $this->assertEquals(['name' => 'John', 'email' => 'john@example.com'], $apiRequestOptions->getBody());
        $this->assertEquals(['Content-Type' => 'application/json'], $apiRequestOptions->getHeaders());
        $this->assertEquals(['format' => 'json'], $apiRequestOptions->getParamsQuery());
        $this->assertEquals(['id' => '123'], $apiRequestOptions->getParamsPath());
        $this->assertEquals('proxy.example.com:8080', $apiRequestOptions->getProxy());
        $this->assertFalse($apiRequestOptions->isVerify());
        $this->assertEquals(ApiRequestBodyType::Json, $apiRequestOptions->getApiRequestBodyType());
    }

    public function testApiRequestOptionsChaining(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $result = $apiRequestOptions
            ->setMethod('POST')
            ->setUri('https://api.example.com/users')
            ->setApiRequestBodyType(ApiRequestBodyType::Json);

        $this->assertInstanceOf(ApiRequestOptions::class, $result);
        $this->assertEquals('POST', $apiRequestOptions->getMethod());
        $this->assertEquals('https://api.example.com/users', $apiRequestOptions->getUri());
        $this->assertEquals(ApiRequestBodyType::Json, $apiRequestOptions->getApiRequestBodyType());
    }

    public function testApiRequestOptionsWithNullParameters(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('GET');
        $apiRequestOptions->setUri('https://api.example.com/users');

        // These methods should handle null gracefully
        $apiRequestOptions->addParamsQuery(null);
        $apiRequestOptions->addParamsPath(null);
        $apiRequestOptions->addBody(null);
        $apiRequestOptions->addHeaders(null);

        $this->assertEquals([], $apiRequestOptions->getParamsQuery());
        $this->assertEquals([], $apiRequestOptions->getParamsPath());
        $this->assertEquals([], $apiRequestOptions->getBody());
        $this->assertEquals([], $apiRequestOptions->getHeaders());
    }

    public function testApiRequestOptionsWithEmptyArrays(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('GET');
        $apiRequestOptions->setUri('https://api.example.com/users');

        $apiRequestOptions->addParamsQuery([]);
        $apiRequestOptions->addParamsPath([]);
        $apiRequestOptions->addBody([]);
        $apiRequestOptions->addHeaders([]);

        $this->assertEquals([], $apiRequestOptions->getParamsQuery());
        $this->assertEquals([], $apiRequestOptions->getParamsPath());
        $this->assertEquals([], $apiRequestOptions->getBody());
        $this->assertEquals([], $apiRequestOptions->getHeaders());
    }

    public function testApiRequestOptionsWithMultipleAdds(): void
    {
        $apiRequestOptions = new ApiRequestOptions();
        $apiRequestOptions->setMethod('POST');
        $apiRequestOptions->setUri('https://api.example.com/users');

        $apiRequestOptions->addParamsQuery(['page' => 1]);
        $apiRequestOptions->addParamsQuery(['limit' => 10]);

        $apiRequestOptions->addBody(['name' => 'John']);
        $apiRequestOptions->addBody(['email' => 'john@example.com']);

        $apiRequestOptions->addHeaders(['Content-Type' => 'application/json']);
        $apiRequestOptions->addHeaders(['Authorization' => 'Bearer token']);

        $this->assertEquals(['page' => 1, 'limit' => 10], $apiRequestOptions->getParamsQuery());
        $this->assertEquals(['name' => 'John', 'email' => 'john@example.com'], $apiRequestOptions->getBody());
        $this->assertEquals(['Content-Type' => 'application/json', 'Authorization' => 'Bearer token'], $apiRequestOptions->getHeaders());
    }

    public function testApiRequestBodyTypeEnum(): void
    {
        $this->assertEquals('none', ApiRequestBodyType::None->value);
        $this->assertEquals('json', ApiRequestBodyType::Json->value);
        $this->assertEquals('x-www-form-urlencoded', ApiRequestBodyType::XWwwFormUrlencoded->value);
        $this->assertEquals('form-data', ApiRequestBodyType::FormData->value);
    }
}
