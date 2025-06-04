# High Availability Module

## Overview

The high availability module provides a complete endpoint management and load balancing solution. The new version design philosophy is **no longer pre-synchronizing endpoint lists**, but dynamically querying endpoints from the business side when needed, then selecting the optimal high-availability endpoint based on statistical data.

## Core Improvements

### 1. Dynamic Endpoint Retrieval
- **Old approach**: High availability module periodically syncs endpoint lists from business side to local storage
- **New approach**: Real-time querying of endpoint lists from business side when `getAvailableEndpoint()` is called

### 2. Architecture Components

#### 2.1 Endpoint Provider Interface (EndpointProviderInterface)
```php
interface EndpointProviderInterface
{
    public function getEndpoints(
        string $modelId,
        string $orgCode,
        ?string $provider = null,
        ?string $endpointName = null
    ): array;
}
```

#### 2.2 High Availability Interface Extension (HighAvailabilityInterface)
Added `getEndpointList()` method:
```php
public function getEndpointList(
    string $modelId,
    string $orgCode,
    ?string $provider = null,
    ?string $endpointName = null
): array;
```

#### 2.3 ModelGateway Endpoint Provider (ModelGatewayEndpointProvider)
Concrete implementation class that gets endpoint list from ModelGateway business module.

## Usage

### 1. Basic Usage

```php
use App\Infrastructure\Core\HighAvailability\Interface\HighAvailabilityInterface;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointRequestDTO;

class YourService 
{
    public function __construct(
        private HighAvailabilityInterface $highAvailability
    ) {}
    
    public function callModel(string $modelId, string $orgCode) 
    {
        // Create endpoint request DTO
        $request = EndpointRequestDTO::create($modelId, $orgCode);
        
        // Get available endpoint
        $endpoint = $this->highAvailability->getAvailableEndpoint($request);
        
        if (!$endpoint) {
            throw new Exception('No available endpoints');
        }
        
        // Use endpoint for API call...
    }
}
```

### 2. Get Endpoint List

```php
// Get all endpoints of specified type
$endpoints = $highAvailability->getEndpointList('deepseek', 'org_code');

// Filter by provider
$endpoints = $highAvailability->getEndpointList('deepseek', 'org_code', 'provider_id');

// Specify specific endpoint
$endpoints = $highAvailability->getEndpointList('deepseek', 'org_code', null, 'endpoint_name');
```

### 3. Load Balancing Strategies

Multiple load balancing strategies are supported:

```php
use App\Infrastructure\Core\HighAvailability\ValueObject\LoadBalancingType;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointRequestDTO;

// Random selection
$request = EndpointRequestDTO::create(
    endpointType: $modelId,
    orgCode: $orgCode,
    balancingType: LoadBalancingType::RANDOM
);
$endpoint = $highAvailability->getAvailableEndpoint($request);

// Round-robin selection
$request = EndpointRequestDTO::create(
    endpointType: $modelId,
    orgCode: $orgCode,
    balancingType: LoadBalancingType::ROUND_ROBIN
);
$endpoint = $highAvailability->getAvailableEndpoint($request);

// Weighted round-robin (based on performance statistics)
$request = EndpointRequestDTO::create(
    endpointType: $modelId,
    orgCode: $orgCode,
    balancingType: LoadBalancingType::WEIGHTED_ROUND_ROBIN
);
$endpoint = $highAvailability->getAvailableEndpoint($request);

// With conversation continuation (prioritize last selected endpoint)
$request = EndpointRequestDTO::create(
    endpointType: $modelId,
    orgCode: $orgCode,
    lastSelectedEndpointId: $rememberedEndpointId
);
$endpoint = $highAvailability->getAvailableEndpoint($request);
```

## Configuration

Configure in `config/autoload/high_availability.php`:

```php
return [
    'dependencies' => [
        EndpointProviderInterface::class => ModelGatewayEndpointProvider::class,
        HighAvailabilityInterface::class => HighAvailabilityService::class,
    ],
    
    'high_availability' => [
        'default_time_range' => 30,        // Default statistics time range (minutes)
        'default_balancing_type' => 'random',
        'default_statistics_level' => 'minute',
        // Other configurations...
    ],
];
```

## Extending Custom Endpoint Providers

If you need to support other business modules, you can implement your own endpoint provider:

```php
use App\Infrastructure\Core\HighAvailability\Interface\EndpointProviderInterface;

class CustomEndpointProvider implements EndpointProviderInterface
{
    public function getEndpoints(
        string $modelId,
        string $orgCode,
        ?string $provider = null,
        ?string $endpointName = null
    ): array {
        // Implement custom endpoint query logic
        return [];
    }
}
```

Then bind in configuration:

```php
'dependencies' => [
    EndpointProviderInterface::class => CustomEndpointProvider::class,
],
```

## Advantages

1. **Real-time**: Endpoint status changes take effect immediately without waiting for synchronization
2. **Flexibility**: Business side can flexibly control endpoint enable/disable status
3. **Decoupling**: High availability module doesn't need to understand business side's specific data structures
4. **Extensibility**: Can easily support endpoint providers for various business scenarios
5. **Consistency**: Avoids data inconsistency issues during synchronization process

## Notes

1. Endpoint queries are executed on each `getAvailableEndpoint()` call, recommend implementing appropriate caching mechanisms on the business side
2. Ensure endpoint provider implementations have good performance and reliability
3. Recommend adding timeout and retry mechanisms for endpoint provider calls
4. Statistical data still needs persistent storage for load balancing decisions 