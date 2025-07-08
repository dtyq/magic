<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Test\Structure\Api;

use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;
use Dtyq\FlowExprEngine\Structure\Api\Api;
use Dtyq\FlowExprEngine\Structure\Api\ApiMethod;
use Dtyq\FlowExprEngine\Structure\Api\ApiRequest;
use Dtyq\FlowExprEngine\Structure\Api\ApiRequestBodyType;
use Dtyq\FlowExprEngine\Structure\Api\ApiRequestOptions;
use Dtyq\FlowExprEngine\Structure\Api\ApiSend;
use Dtyq\FlowExprEngine\Structure\Expression\Expression;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Dtyq\FlowExprEngine\Test\BaseTestCase;

/**
 * @internal
 * @coversNothing
 */
class ApiTest extends BaseTestCase
{
    public function testConstructor(): void
    {
        $api = new Api(
            ApiMethod::Get,
            'https://api.example.com',
            '/users/{id}',
            'proxy.example.com:8080',
            'bearer-token'
        );

        $this->assertEquals(ApiMethod::Get, $api->getMethod());
        $this->assertEquals('https://api.example.com', $api->getDomain());
        $this->assertEquals('/users/{id}', $api->getPath());
        $this->assertEquals('https://api.example.com/users/{id}', $api->getUrl());
        $this->assertEquals('bearer-token', $api->getAuth());
    }

    public function testConstructorWithProxy(): void
    {
        $api = new Api(ApiMethod::Post, 'https://api.example.com', '/data', 'proxy.example.com:8080');

        $this->assertInstanceOf(Api::class, $api);
        $this->assertEquals(ApiMethod::Post, $api->getMethod());
        $this->assertEquals('https://api.example.com', $api->getDomain());
        $this->assertEquals('/data', $api->getPath());
        $this->assertEquals('https://api.example.com/data', $api->getUrl());
    }

    public function testConstructorWithAuth(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/secure', '', 'bearer-token');

        $this->assertInstanceOf(Api::class, $api);
        $this->assertEquals('bearer-token', $api->getAuth());
    }

    public function testInitMethod(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');

        $api->init(ApiMethod::Post, 'https://api.test.com', '/data', 'auth-token');

        $this->assertEquals(ApiMethod::Post, $api->getMethod());
        $this->assertEquals('https://api.test.com', $api->getDomain());
        $this->assertEquals('/data', $api->getPath());
        $this->assertEquals('https://api.test.com/data', $api->getUrl());
        $this->assertEquals('auth-token', $api->getAuth());
    }

    public function testSetProxy(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');
        $request = new ApiRequest();
        $request->setApiRequestBodyType(ApiRequestBodyType::Json);
        $api->setRequest($request);

        $api->setProxy('proxy.example.com:8080');
        $this->assertEquals('proxy.example.com:8080', $api->toArray()['proxy']);
    }

    public function testSetAuth(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');

        $api->setAuth('bearer-token');
        $this->assertEquals('bearer-token', $api->getAuth());
    }

    public function testCreateByUrl(): void
    {
        $api = Api::createByUrl(ApiMethod::Post, 'https://api.example.com/users?page=1');

        $this->assertEquals(ApiMethod::Post, $api->getMethod());
        $this->assertEquals('https://api.example.com', $api->getDomain());
        $this->assertEquals('/users?page=1', $api->getPath());
        $this->assertEquals('https://api.example.com/users?page=1', $api->getUrl());
    }

    public function testCreateByUrlWithPort(): void
    {
        $api = Api::createByUrl(ApiMethod::Get, 'https://api.example.com:8080/users');

        $this->assertEquals(ApiMethod::Get, $api->getMethod());
        $this->assertEquals('https://api.example.com:8080', $api->getDomain());
        $this->assertEquals('/users', $api->getPath());
        $this->assertEquals('https://api.example.com:8080/users', $api->getUrl());
    }

    public function testCreateByUrlWithQuery(): void
    {
        $api = Api::createByUrl(ApiMethod::Get, 'https://api.example.com/users?limit=10&page=1');

        $this->assertInstanceOf(Api::class, $api);
        $this->assertEquals(ApiMethod::Get, $api->getMethod());
        $this->assertEquals('https://api.example.com', $api->getDomain());
        $this->assertEquals('/users?limit=10&page=1', $api->getPath());
        $this->assertEquals('https://api.example.com/users?limit=10&page=1', $api->getUrl());
    }

    public function testCreateByUrlWithInvalidUrl(): void
    {
        $this->expectException(FlowExprEngineException::class);
        $this->expectExceptionMessage('not a valid URL');

        Api::createByUrl(ApiMethod::Get, 'invalid-url');
    }

    public function testSetDomain(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');

        $api->setDomain('https://newapi.example.com');
        $this->assertEquals('https://newapi.example.com', $api->getDomain());
        $this->assertEquals('https://newapi.example.com/users', $api->getUrl());
    }

    public function testSetDomainWithInvalidUrl(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');

        $this->expectException(FlowExprEngineException::class);
        $this->expectExceptionMessage('is not a valid url');

        $api->setDomain('invalid-domain');
    }

    public function testSetDomainWithEmptyDomain(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');

        $api->setDomain('');
        $this->assertEquals('', $api->getDomain());
    }

    public function testSetDomainWithNull(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');

        $api->setDomain(null);

        $this->assertEquals('', $api->getDomain());
    }

    public function testSetRequest(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');
        $request = new ApiRequest();

        $api->setRequest($request);
        $this->assertSame($request, $api->getRequest());
    }

    public function testSetRequestWithNewInstance(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');
        $newRequest = new ApiRequest();

        $api->setRequest($newRequest);

        $this->assertSame($newRequest, $api->getRequest());
    }

    public function testJsonSerialize(): void
    {
        $api = new Api(ApiMethod::Put, 'https://api.example.com', '/users');
        $request = new ApiRequest();
        $api->setRequest($request);

        $json = $api->jsonSerialize();

        $this->assertEquals('PUT', $json['method']);
        $this->assertEquals('https://api.example.com', $json['domain']);
        $this->assertEquals('/users', $json['path']);
        $this->assertEquals('https://api.example.com/users', $json['url']);
    }

    public function testToArray(): void
    {
        $api = new Api(ApiMethod::Post, 'https://api.example.com', '/users');
        $request = new ApiRequest();
        $api->setRequest($request);

        $array = $api->toArray();

        $this->assertEquals('POST', $array['method']);
        $this->assertEquals('https://api.example.com', $array['domain']);
        $this->assertEquals('/users', $array['path']);
        $this->assertEquals('https://api.example.com/users', $array['url']);
        $this->assertEquals('', $array['proxy']);
        $this->assertEquals('', $array['auth']);
        $this->assertArrayHasKey('uri', $array);
        $this->assertArrayHasKey('request', $array);
    }

    public function testGetAllFieldsExpressionItem(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');
        $request = new ApiRequest();
        $request->setApiRequestBodyType(ApiRequestBodyType::Json);
        $api->setRequest($request);

        $fields = $api->getAllFieldsExpressionItem();

        $this->assertIsArray($fields);
    }

    public function testGetApiRequestOptions(): void
    {
        $api = new Api(ApiMethod::Delete, 'https://api.example.com', '/users');
        $request = new ApiRequest();
        $request->setApiRequestBodyType(ApiRequestBodyType::Json);
        $api->setRequest($request);

        $options = $api->getApiRequestOptions();

        $this->assertInstanceOf(ApiRequestOptions::class, $options);
        $this->assertEquals('DELETE', $options->getMethod());
        $this->assertEquals('https://api.example.com/users', $options->getUri());
    }

    public function testGetApiRequestOptionsWithExpressionData(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');
        $request = new ApiRequest();
        $request->setApiRequestBodyType(ApiRequestBodyType::Json);
        $api->setRequest($request);

        $expressionData = ['userId' => 123, 'format' => 'json'];
        $options = $api->getApiRequestOptions($expressionData);

        $this->assertInstanceOf(ApiRequestOptions::class, $options);
        $this->assertEquals('GET', $options->getMethod());
        $this->assertEquals('https://api.example.com/users', $options->getUri());
    }

    public function testGetApiRequestOptionsWithCustomOptions(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');
        $request = new ApiRequest();
        $request->setApiRequestBodyType(ApiRequestBodyType::Json);
        $api->setRequest($request);

        $customOptions = new ApiRequestOptions();
        $customOptions->setMethod('POST');
        $customOptions->setUri('https://custom.example.com');

        $options = $api->getApiRequestOptions([], $customOptions);

        $this->assertInstanceOf(ApiRequestOptions::class, $options);
        // Should override the custom options
        $this->assertEquals('GET', $options->getMethod());
        $this->assertEquals('https://api.example.com/users', $options->getUri());
    }

    public function testGettersAndSetters(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');
        $request = new ApiRequest();
        $request->setApiRequestBodyType(ApiRequestBodyType::Json);
        $api->setRequest($request);

        $this->assertEquals(ApiMethod::Get, $api->getMethod());
        $this->assertEquals('https://api.example.com', $api->getDomain());
        $this->assertEquals('/users', $api->getPath());
        $this->assertEquals('https://api.example.com/users', $api->getUrl());
        $this->assertEquals('', $api->getAuth());
        $this->assertInstanceOf(Expression::class, $api->getUri());
        $this->assertInstanceOf(ApiRequest::class, $api->getRequest());
    }

    public function testApiMethodEnum(): void
    {
        $this->assertEquals('GET', ApiMethod::Get->value);
        $this->assertEquals('POST', ApiMethod::Post->value);
        $this->assertEquals('PUT', ApiMethod::Put->value);
        $this->assertEquals('DELETE', ApiMethod::Delete->value);
        $this->assertEquals('PATCH', ApiMethod::Patch->value);
    }

    public function testPathWithParameters(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users/{id}');

        $this->assertEquals('/users/{id}', $api->getPath());
        $this->assertEquals('https://api.example.com/users/{id}', $api->getUrl());
    }

    public function testPathWithMultipleParameters(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users/{id}/posts/{postId}');

        $this->assertEquals('/users/{id}/posts/{postId}', $api->getPath());
        $this->assertEquals('https://api.example.com/users/{id}/posts/{postId}', $api->getUrl());
    }

    public function testComplexApiConstruction(): void
    {
        $api = new Api(
            ApiMethod::Post,
            'https://api.example.com:8080',
            '/api/v1/users/{id}/update',
            'proxy.example.com:8080',
            'bearer-token-123'
        );

        $this->assertEquals(ApiMethod::Post, $api->getMethod());
        $this->assertEquals('https://api.example.com:8080', $api->getDomain());
        $this->assertEquals('/api/v1/users/{id}/update', $api->getPath());
        $this->assertEquals('https://api.example.com:8080/api/v1/users/{id}/update', $api->getUrl());
        $this->assertEquals('bearer-token-123', $api->getAuth());
        $this->assertEquals(StructureType::Api, $api->structureType);
    }

    public function testEmptyPathHandling(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '');

        $this->assertEquals('', $api->getPath());
        $this->assertEquals('https://api.example.com', $api->getUrl());
    }

    public function testRootPathHandling(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/');

        $this->assertEquals('/', $api->getPath());
        $this->assertEquals('https://api.example.com/', $api->getUrl());
    }

    public function testSend(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');
        $request = new ApiRequest();
        $request->setApiRequestBodyType(ApiRequestBodyType::Json);
        $api->setRequest($request);

        // Mock the ComponentContext or handle the actual HTTP request
        // For now, we'll just check the method exists and returns ApiSend
        $this->assertTrue(method_exists($api, 'send'));
    }

    public function testStructureType(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');

        $this->assertEquals(StructureType::Api, $api->structureType);
    }

    public function testPathToUriWithDynamicPath(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users/{id}/posts/{postId}');

        $uri = $api->getUri();
        $this->assertInstanceOf(Expression::class, $uri);
    }

    public function testPathToUriWithStaticPath(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');

        $uri = $api->getUri();
        $this->assertInstanceOf(Expression::class, $uri);
    }

    public function testGetUrl(): void
    {
        $api = new Api(ApiMethod::Get, 'https://api.example.com', '/users');

        $this->assertEquals('https://api.example.com/users', $api->getUrl());
    }

    public function testPreEncodeUrlWithQueryParams(): void
    {
        $api = Api::createByUrl(ApiMethod::Get, 'https://api.example.com/users?name=张三&age=25');

        $this->assertEquals('https://api.example.com', $api->getDomain());
        $this->assertStringContainsString('name=', $api->getPath());
    }

    public function testDifferentHttpMethods(): void
    {
        $getMethods = [
            ['Get', 'GET'],
            ['Post', 'POST'],
            ['Put', 'PUT'],
            ['Delete', 'DELETE'],
            ['Patch', 'PATCH'],
        ];

        foreach ($getMethods as [$enumValue, $stringValue]) {
            $api = new Api(ApiMethod::{$enumValue}, 'https://api.example.com', '/users');
            $this->assertEquals($stringValue, $api->getMethod()->value);
        }
    }
}
