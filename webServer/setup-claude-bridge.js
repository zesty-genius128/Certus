#!/usr/bin/env node

/**
 * Setup script for Claude Desktop MCP Bridge
 * 
 * This script helps configure Claude Desktop to connect to the hosted MCP server
 * by setting up the bridge client and updating the Claude Desktop config.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ClaudeBridgeSetup {
    constructor() {
        this.platform = os.platform();
        this.configPaths = this.getClaudeConfigPaths();
        this.currentDir = process.cwd();
    }

    getClaudeConfigPaths() {
        const homeDir = os.homedir();
        
        switch (this.platform) {
            case 'darwin': // macOS
                return [
                    path.join(homeDir, 'Library/Application Support/Claude/claude_desktop_config.json')
                ];
            case 'win32': // Windows
                return [
                    path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json'),
                    path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
                ];
            case 'linux': // Linux
                return [
                    path.join(homeDir, '.config/Claude/claude_desktop_config.json'),
                    path.join(homeDir, '.claude/claude_desktop_config.json')
                ];
            default:
                return [path.join(homeDir, '.config/Claude/claude_desktop_config.json')];
        }
    }

    findClaudeConfig() {
        for (const configPath of this.configPaths) {
            if (fs.existsSync(configPath)) {
                return configPath;
            }
        }
        return null;
    }

    createClaudeConfigDir() {
        const primaryPath = this.configPaths[0];
        const configDir = path.dirname(primaryPath);
        
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
            console.log(`Created Claude config directory: ${configDir}`);
        }
        
        return primaryPath;
    }

    getBridgeClientPath() {
        const bridgePath = path.join(this.currentDir, 'mcp-bridge-client.js');
        if (!fs.existsSync(bridgePath)) {
            throw new Error(`Bridge client not found at: ${bridgePath}`);
        }
        return bridgePath;
    }

    createConfig(serverUrl, configPath) {
        const bridgeClientPath = this.getBridgeClientPath();
        
        const config = {
            mcpServers: {
                "unified-medication-info": {
                    command: "node",
                    args: [bridgeClientPath],
                    env: {
                        MCP_SERVER_URL: serverUrl,
                        MCP_TIMEOUT: "30000",
                        MCP_BRIDGE_TYPE: "simple"
                    }
                }
            }
        };

        return config;
    }

    updateExistingConfig(existingConfig, serverUrl) {
        const bridgeClientPath = this.getBridgeClientPath();
        
        if (!existingConfig.mcpServers) {
            existingConfig.mcpServers = {};
        }

        existingConfig.mcpServers["unified-medication-info"] = {
            command: "node",
            args: [bridgeClientPath],
            env: {
                MCP_SERVER_URL: serverUrl,
                MCP_TIMEOUT: "30000",
                MCP_BRIDGE_TYPE: "simple"
            }
        };

        return existingConfig;
    }

    async promptUser(question) {
        return new Promise((resolve) => {
            process.stdout.write(question);
            process.stdin.once('data', (data) => {
                resolve(data.toString().trim());
            });
        });
    }

    async testServerConnection(serverUrl) {
        try {
            const healthUrl = serverUrl.replace('/mcp', '/health');
            const response = await fetch(healthUrl, { timeout: 5000 });
            
            if (response.ok) {
                const health = await response.json();
                console.log(`✅ Server is running: ${health.server} v${health.version}`);
                return true;
            } else {
                console.log(`❌ Server responded with status: ${response.status}`);
                return false;
            }
        } catch (error) {
            console.log(`❌ Cannot connect to server: ${error.message}`);
            return false;
        }
    }

    async setup() {
        console.log('🔧 Claude Desktop MCP Bridge Setup\n');

        // Step 1: Check for bridge client
        try {
            const bridgeClientPath = this.getBridgeClientPath();
            console.log(`✅ Found bridge client: ${bridgeClientPath}`);
        } catch (error) {
            console.log(`❌ ${error.message}`);
            console.log('Please make sure mcp-bridge-client.js is in the current directory.');
            return false;
        }

        // Step 2: Get server URL
        const defaultUrl = 'http://localhost:3000/mcp';
        const serverUrl = await this.promptUser(`Enter MCP server URL [${defaultUrl}]: `) || defaultUrl;

        // Step 3: Test server connection
        console.log(`\n🔍 Testing connection to: ${serverUrl}`);
        const serverRunning = await this.testServerConnection(serverUrl);
        
        if (!serverRunning) {
            const proceed = await this.promptUser('\n⚠️  Server is not responding. Continue anyway? [y/N]: ');
            if (proceed.toLowerCase() !== 'y') {
                console.log('Setup cancelled. Please start your server first.');
                return false;
            }
        }

        // Step 4: Find or create Claude config
        let configPath = this.findClaudeConfig();
        let existingConfig = null;

        if (configPath) {
            console.log(`\n📁 Found existing Claude config: ${configPath}`);
            try {
                const configContent = fs.readFileSync(configPath, 'utf8');
                existingConfig = JSON.parse(configContent);
            } catch (error) {
                console.log(`⚠️  Error reading existing config: ${error.message}`);
                existingConfig = null;
            }
        } else {
            console.log('\n📁 No existing Claude config found, creating new one...');
            configPath = this.createClaudeConfigDir();
        }

        // Step 5: Create or update config
        let newConfig;
        if (existingConfig) {
            newConfig = this.updateExistingConfig(existingConfig, serverUrl);
            console.log('📝 Updated existing Claude config');
        } else {
            newConfig = this.createConfig(serverUrl, configPath);
            console.log('📝 Created new Claude config');
        }

        // Step 6: Write config file
        try {
            fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
            console.log(`✅ Config written to: ${configPath}`);
        } catch (error) {
            console.log(`❌ Error writing config: ${error.message}`);
            return false;
        }

        // Step 7: Show next steps
        console.log('\n🎉 Setup complete!\n');
        console.log('Next steps:');
        console.log('1. Restart Claude Desktop');
        console.log('2. Test with: "Check if aspirin has any current shortages"');
        console.log('3. Verify the medication tools are available\n');

        console.log('Configuration summary:');
        console.log(`  Server URL: ${serverUrl}`);
        console.log(`  Bridge script: ${this.getBridgeClientPath()}`);
        console.log(`  Claude config: ${configPath}`);

        if (!serverRunning) {
            console.log('\n⚠️  Remember to start your server before using Claude!');
            console.log('   Run: npm start (or docker-compose up -d)');
        }

        return true;
    }

    async interactive() {
        process.stdin.setEncoding('utf8');
        
        try {
            await this.setup();
        } catch (error) {
            console.log(`\n❌ Setup failed: ${error.message}`);
            return false;
        } finally {
            process.stdin.pause();
        }
    }

    displayHelp() {
        console.log(`
Claude Desktop MCP Bridge Setup

Usage:
  node setup-claude-bridge.js              # Interactive setup
  node setup-claude-bridge.js --help       # Show this help
  node setup-claude-bridge.js --check      # Check current configuration

This script will:
1. Verify the bridge client exists
2. Test connection to your MCP server  
3. Update Claude Desktop configuration
4. Provide setup verification steps

Requirements:
- mcp-bridge-client.js in current directory
- MCP server running (or provide URL for later)
- Claude Desktop installed

Supported platforms: macOS, Windows, Linux
        `);
    }

    async checkConfiguration() {
        console.log('🔍 Checking current configuration...\n');

        // Check bridge client
        try {
            const bridgeClientPath = this.getBridgeClientPath();
            console.log(`✅ Bridge client found: ${bridgeClientPath}`);
        } catch (error) {
            console.log(`❌ Bridge client missing: ${error.message}`);
        }

        // Check Claude config
        const configPath = this.findClaudeConfig();
        if (configPath) {
            console.log(`✅ Claude config found: ${configPath}`);
            
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                const mcpServer = config.mcpServers?.['unified-medication-info'];
                
                if (mcpServer) {
                    console.log(`✅ MCP server configured`);
                    console.log(`   Server URL: ${mcpServer.env?.MCP_SERVER_URL || 'Not set'}`);
                    console.log(`   Bridge script: ${mcpServer.args?.[0] || 'Not set'}`);
                    
                    // Test server if URL is set
                    if (mcpServer.env?.MCP_SERVER_URL) {
                        console.log('\n🔍 Testing server connection...');
                        await this.testServerConnection(mcpServer.env.MCP_SERVER_URL);
                    }
                } else {
                    console.log(`❌ MCP server not configured in Claude config`);
                }
            } catch (error) {
                console.log(`❌ Error reading Claude config: ${error.message}`);
            }
        } else {
            console.log(`❌ Claude config not found`);
            console.log(`   Expected locations: ${this.configPaths.join(', ')}`);
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const setup = new ClaudeBridgeSetup();

    if (args.includes('--help') || args.includes('-h')) {
        setup.displayHelp();
    } else if (args.includes('--check')) {
        await setup.checkConfiguration();
    } else {
        await setup.interactive();
    }
}

main().catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
});