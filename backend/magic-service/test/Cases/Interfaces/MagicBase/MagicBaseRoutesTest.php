<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\MagicBase;

use App\Application\Authentication\Service\AuthUserAppService;
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Middleware\Auth\OptionalUserAuthMiddleware;
use FastRoute\Dispatcher;
use Hyperf\HttpServer\Router\DispatcherFactory;
use Hyperf\HttpServer\Router\Router;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;

/** @internal */
class MagicBaseRoutesTest extends TestCase
{
    public function testAnonymousQueryReachesShareAuthorizationInsteadOfMandatoryLogin(): void
    {
        $handler = $this->routes()->dispatch('POST', '/api/v1/magicbase/projects/11/tables/22/query')[1];
        $auth = $this->createMock(AuthUserAppService::class);
        $auth->method('authenticate')->willThrowException(new RuntimeException('Login required'));
        $auth->method('tryAuthenticate')->willReturn(null);
        $response = $this->createMock(ResponseInterface::class);
        $next = $this->createMock(RequestHandlerInterface::class);
        $next->expects(self::once())->method('handle')->willReturn($response);
        $middlewareClass = $handler->options['middleware'][0];
        $middleware = new $middlewareClass($auth);
        // Invoke the real authentication boundary without booting logging/Redis services.
        $result = (new ReflectionMethod($middleware, 'doProcess'))->invoke(
            $middleware,
            $this->createMock(ServerRequestInterface::class),
            $next
        );
        self::assertSame($response, $result);
    }

    public function testOnlyDataReadRoutesAllowOptionalLogin(): void
    {
        $dispatcher = $this->routes();
        $readRoutes = [
            ['GET', '/tables'], ['GET', '/tables/22'],
            ['POST', '/tables/22/query'], ['GET', '/tables/22/rows/33'],
        ];
        $protectedRoutes = [
            ['GET', '/admin-access'], ['POST', '/tables'], ['PATCH', '/tables/22'], ['DELETE', '/tables/22'],
            ['POST', '/tables/22/columns'], ['PATCH', '/tables/22/columns/33'], ['DELETE', '/tables/22/columns/33'],
            ['POST', '/tables/22/rows'], ['POST', '/tables/22/rows/batch'], ['POST', '/tables/22/rows/batch-delete'],
            ['PATCH', '/tables/22/rows/33'], ['DELETE', '/tables/22/rows/33'],
            ['POST', '/relations'], ['GET', '/relations'], ['PATCH', '/relations/33'], ['DELETE', '/relations/33'],
            ['POST', '/admins/project'], ['POST', '/tables/22/admins'], ['GET', '/tables/22/permissions'],
            ['POST', '/tables/22/permissions/batch'], ['DELETE', '/tables/22/permissions/table/33'],
            ['POST', '/tables/22/permissions/table'], ['POST', '/tables/22/permissions/columns'], ['POST', '/tables/22/permissions/rows'],
        ];
        foreach ([$readRoutes, $protectedRoutes] as $index => $routes) {
            foreach ($routes as [$method, $path]) {
                $route = $dispatcher->dispatch($method, '/api/v1/magicbase/projects/11' . $path);
                self::assertSame(Dispatcher::FOUND, $route[0], $method . $path);
                self::assertSame(
                    [$index === 0 ? OptionalUserAuthMiddleware::class : RequestContextMiddleware::class],
                    $route[1]->options['middleware'],
                    $method . $path
                );
            }
        }
    }

    private function routes(): Dispatcher
    {
        if (! defined('BASE_PATH')) {
            define('BASE_PATH', dirname(__DIR__, 4));
        }
        $factoryProperty = new ReflectionProperty(Router::class, 'factory');
        $previous = $factoryProperty->getValue();
        $factory = (new ReflectionClass(DispatcherFactory::class))->newInstanceWithoutConstructor();
        try {
            Router::init($factory);
            require dirname(__DIR__, 4) . '/config/routes-v1/magicbase.php';
            return $factory->getDispatcher('http');
        } finally {
            $factoryProperty->setValue(null, $previous);
        }
    }
}
