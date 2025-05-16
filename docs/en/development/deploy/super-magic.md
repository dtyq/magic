# Super Magic Installation and Usage Guide

This guide will walk you through how to install, configure, and use the Super Magic service.

## Prerequisites

Before getting started, make sure your system has the following software installed:

- Docker
- Docker Compose
- Git

## Installation Steps

### 1. Get the Project Code

```bash
git clone https://github.com/dtyq/magic.git
cd magic
```

### 2. Configure Environment Files

The Super Magic service depends on several key configuration files:

#### 2.1 Create Super Magic Configuration File

```bash
cp config/.env_super_magic.example config/.env_super_magic
```
Configure Super Magic environment variables. You must configure at least one large language model environment variable that supports the OpenAI format for proper functionality.

Edit the `config/.env_super_magic` file to configure necessary environment variables:

```bash
vim config/.env_super_magic
```

### 3. Run the Installation Script

Use the `magic.sh` script provided with the project for installation:

```bash
./bin/magic.sh
```

When running for the first time, the installation script will perform the following operations:

1. Detect system language and allow you to choose the interface language (Chinese or English)
2. Check if Docker and Docker Compose are installed and running
3. Detect system architecture and set appropriate platform parameters
4. Ask about deployment method (local computer deployment or remote server deployment)
5. If remote server deployment is selected, detect public IP and update related configurations
6. Ask whether to install Super Magic service

When prompted "Do you want to install Super Magic service?", select "1" to install the Super Magic service.

## Usage Guide

### Starting Services

#### Start All Services in Foreground

```bash
./bin/magic.sh start
```

#### Start All Services in Background

```bash
./bin/magic.sh daemon
```

#### Start Only Super Magic Service (Foreground)

```bash
./bin/magic.sh super-magic
```

#### Start Only Super Magic Service (Background)

```bash
./bin/magic.sh super-magic-daemon
```

### Managing Services

#### View Service Status

```bash
./bin/magic.sh status
```

#### View Service Logs

```bash
./bin/magic.sh logs
```

#### Restart Services

```bash
./bin/magic.sh restart
```

#### Stop Services

```bash
./bin/magic.sh stop
```

## Configuration Details

### Super Magic Environment Configuration

The `config/.env_super_magic` file contains the following important configuration items:

#### Basic Configuration
- `APP_ENV`: Application environment setting, possible values include "test", "production", etc.
- `LOG_LEVEL`: Log level, such as INFO, DEBUG, ERROR, etc.
- `STORAGE_PLATFORM`: Storage platform, default is "local"

#### Tool Call Configuration
- `AGENT_ENABLE_MULTI_TOOL_CALLS`: Whether to enable multiple tool calls (True/False)
- `AGENT_ENABLE_PARALLEL_TOOL_CALLS`: Whether to enable parallel tool calls (True/False)

#### Large Language Model Configuration

##### OpenAI Configuration
- `OPENAI_API_BASE_URL`: Base URL for OpenAI API
- `OPENAI_API_KEY`: OpenAI API key
- `OPENAI_MODEL`: Default OpenAI model to use, e.g., "gpt-4o-global"
- `OPENAI_4_1_MODEL`: OpenAI 4.1 model name
- `OPENAI_4_1_MINI_MODEL`: OpenAI 4.1 Mini model name
- `OPENAI_4_1_NANO_MODEL`: OpenAI 4.1 Nano model name

#### Vector Database Configuration
- `QDRANT_COLLECTION_PREFIX`: Qdrant collection prefix, default is "SUPERMAGIC-"

#### Browser Configuration
- `BROWSER_HEADLESS`: Whether the browser runs in headless mode (True/False)
- `BROWSER_STORAGE_STATE_TEMPLATE_URL`: Browser storage state template URL

#### Search Configuration
- `BING_SUBSCRIPTION_ENDPOINT`: Bing search API endpoint
- `BING_SUBSCRIPTION_KEY`: Bing search subscription key

#### Model Service Configuration

##### OpenAI Service
- `OPENAI_API_KEY`: OpenAI API key
- `OPENAI_API_BASE_URL`: OpenAI API base URL
- `OPENAI_MODEL`: OpenAI model to use

## Troubleshooting

### Common Issues

1. **Configuration Files Don't Exist**

   Make sure you have copied and properly configured all necessary environment files from the example files:
   - `config/.env_sandbox_gateway`

2. **Service Startup Failure**

   Check if the Docker service is running properly:
   ```bash
   docker info
   ```

   View service logs for detailed error information:
   ```bash
   ./bin/magic.sh logs
   ```

3. **Network Connection Issues**

   If using remote deployment, ensure that the configured IP address is correct and relevant ports are open:
   - Super Magic service ports
   - Gateway service ports

## Advanced Configuration

### Custom Deployment

For custom deployment scenarios, you can edit the `.env` file to modify the following configurations:

- Service port mappings
- Data persistence paths
- Resource limitations

### Manual Configuration

If you need to perform more granular configurations manually, you can directly edit the `docker-compose.yml` file.

## Updating the Service

When you need to update the Super Magic service, follow these steps:

1. Pull the latest code
   ```bash
   git pull
   ```

2. Rebuild and restart services
   ```bash
   ./bin/magic.sh restart
   ```

## Conclusion

Through this guide, you should have successfully installed and configured the Super Magic service. If you have any questions, please refer to the project documentation or contact the technical support team.
