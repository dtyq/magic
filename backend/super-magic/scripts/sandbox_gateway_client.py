#!/usr/bin/env python
import os
import sys
import json
import uuid
import asyncio
import argparse
import websockets
from pathlib import Path

# Add project root directory to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from agentlang.utils.json import json_dumps
from agentlang.logger import get_logger

# Get logger
logger = get_logger(__name__)

# Config file path
CONFIG_FILE = project_root / "debug" / "upload_credentials.json"

def load_upload_config():
    """
    Load upload credentials from config file

    Returns:
        dict: Upload configuration
    """
    if not CONFIG_FILE.exists():
        logger.warning(f"Config file {CONFIG_FILE} doesn't exist, using default config")
        return {}

    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read config file: {e}")
        return {}

def create_init_message():
    """
    Create workspace initialization message

    Returns:
        dict: Workspace initialization data
    """
    # Load upload config
    upload_config = load_upload_config()

    if not upload_config:
        logger.error("Failed to load upload config, workspace initialization may fail")

    return {
        "message_id": str(uuid.uuid4()),
        "type": "init",
        "upload_config": upload_config
    }

def create_chat_message(prompt):
    """
    Create chat message

    Args:
        prompt: Chat prompt content

    Returns:
        dict: Chat message data
    """
    return {
        "message_id": str(uuid.uuid4()),
        "type": "chat",
        "prompt": prompt,
        "attachments": []
    }

async def create_sandbox(uri, sandbox_name=None):
    """
    Create a sandbox via POST request to the sandbox gateway

    Args:
        uri: Sandbox gateway URL
        sandbox_name: Optional name for the sandbox

    Returns:
        dict: Response data containing sandbox_id
    """
    import aiohttp

    logger.info(f"Creating sandbox at {uri}...")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(uri) as response:
                if response.status != 200:
                    logger.error(f"Failed to create sandbox: HTTP {response.status}")
                    response_text = await response.text()
                    logger.error(f"Response: {response_text}")
                    return None

                data = await response.json()
                logger.info(f"Sandbox created successfully: {json_dumps(data, indent=2)}")
                return data
    except Exception as e:
        logger.error(f"Error creating sandbox: {e}")
        return None

async def connect_to_sandbox(ws_uri, chat_prompt):
    """
    Connect to the sandbox websocket, first send init request,
    wait for running status, and then send a chat message

    Args:
        ws_uri: WebSocket URI for the sandbox
        chat_prompt: Chat prompt to send
    """
    logger.info(f"Connecting to sandbox WebSocket at {ws_uri}...")

    try:
        async with websockets.connect(ws_uri) as websocket:
            # Step 1: Send initialization message first
            init_message = create_init_message()
            logger.info("Sending workspace initialization message...")
            await websocket.send(json_dumps(init_message))
            logger.debug(f"Sent workspace initialization message: {json_dumps(init_message, indent=2)}")

            # Step 2: Wait for initialization responses until running status is confirmed
            init_completed = False
            while not init_completed:
                response = await websocket.recv()
                logger.debug(f"Received response: {response}")

                # Parse response
                response_data = json.loads(response)

                # Check if it's an error message
                if "type" in response_data and response_data["type"] == "error":
                    logger.error("Workspace initialization failed, terminating operation")
                    return

                # Check if it's a task message with initialization complete flag
                if ("type" in response_data and response_data["type"] == "init" and
                    "status" in response_data and response_data["status"] == "running"):
                    logger.info("Initialization process completed")
                    init_completed = True

            # Step 3: After successful initialization, send chat message
            logger.info("\nSending chat message...")
            chat_data = create_chat_message(chat_prompt)
            await websocket.send(json_dumps(chat_data))
            logger.debug(f"Sent chat message: {json_dumps(chat_data, indent=2)}")

            # Step 4: Continuously receive responses
            while True:
                response = await websocket.recv()
                response_data = json.loads(response)
                logger.info(f"Received response: {json_dumps(response_data, indent=2)}")

                # If this is a final response or completion, break the loop
                # Adjust this condition based on actual API response structure
                if "status" in response_data and response_data["status"] == "completed":
                    break

    except websockets.exceptions.ConnectionClosed:
        logger.warning("Connection closed")
    except Exception as e:
        logger.error(f"Error in WebSocket connection: {e}")

async def main_async():
    parser = argparse.ArgumentParser(description='Sandbox Gateway Client')
    parser.add_argument('--host', type=str, default='127.0.0.1',
                        help='Sandbox gateway host (default: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=8003,
                        help='Sandbox gateway port (default: 8003)')
    parser.add_argument('--prompt', type=str,
                        default='https://www.magicrew.ai/ 这个网站有什么内容，风格是怎么样的',
                        help='Chat prompt to send to the sandbox')
    parser.add_argument('--config', type=str, default=None,
                        help='Specify config file path (defaults to debug/upload_credentials.json)')
    args = parser.parse_args()

    # If config file specified, override default path
    global CONFIG_FILE
    if args.config:
        CONFIG_FILE = Path(args.config)

    # Step 1: Create sandbox
    sandbox_uri = f"http://{args.host}:{args.port}/sandboxes"
    sandbox_data = await create_sandbox(sandbox_uri)

    if not sandbox_data or "data" not in sandbox_data or "sandbox_id" not in sandbox_data["data"]:
        logger.error("Failed to create sandbox or get sandbox_id")
        return

    # Extract sandbox_id
    sandbox_id = sandbox_data["data"]["sandbox_id"]
    logger.info(f"Using sandbox_id: {sandbox_id}")

    # Step 2: Connect to the sandbox WebSocket and send chat message
    ws_uri = f"ws://{args.host}:{args.port}/sandboxes/ws/{sandbox_id}"
    await connect_to_sandbox(ws_uri, args.prompt)

def main():
    """Entry point for the script"""
    asyncio.run(main_async())

if __name__ == "__main__":
    main()
