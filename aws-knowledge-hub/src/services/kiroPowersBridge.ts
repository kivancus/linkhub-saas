import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';

/**
 * Kiro Powers Bridge Service
 * 
 * This service provides a bridge between the Node.js application and Kiro Powers
 * by creating HTTP endpoints that can be called from the application.
 */

interface KiroPowersBridgeResponse {
  success: boolean;
  data?: any;
  error?: string;
  source: 'real' | 'mock';
}

class KiroPowersBridgeService {
  private readonly BRIDGE_PORT = 3002;
  private server: any = null;

  /**
   * Start the Kiro Powers bridge server
   */
  public async startBridge(): Promise<void> {
    try {
      const express = require('express');
      const app = express();
      
      app.use(express.json());
      
      // CORS middleware
      app.use((req: any, res: any, next: any) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      });

      // Health check endpoint
      app.get('/health', (req: any, res: any) => {
        res.json({ status: 'ok', service: 'kiro-powers-bridge' });
      });

      // Kiro Powers proxy endpoint
      app.post('/kiro/powers/use', async (req: any, res: any) => {
        try {
          const { powerName, serverName, toolName, arguments: args } = req.body;
          
          logger.info('Bridge received Kiro Powers request', {
            powerName,
            serverName,
            toolName
          });

          // Try to call real Kiro Powers
          const result = await this.callRealKiroPowers(powerName, serverName, toolName, args);
          
          res.json({
            success: true,
            data: result,
            source: 'real'
          });

        } catch (error) {
          logger.error('Bridge Kiro Powers call failed', {
            error: getErrorMessage(error)
          });
          
          res.status(500).json({
            success: false,
            error: getErrorMessage(error),
            source: 'error'
          });
        }
      });

      this.server = app.listen(this.BRIDGE_PORT, () => {
        logger.info(`Kiro Powers bridge server started on port ${this.BRIDGE_PORT}`);
      });

    } catch (error) {
      logger.error('Failed to start Kiro Powers bridge server', {
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  /**
   * Stop the bridge server
   */
  public async stopBridge(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;
      logger.info('Kiro Powers bridge server stopped');
    }
  }

  /**
   * Call real Kiro Powers (this will be implemented to work in the Kiro environment)
   */
  private async callRealKiroPowers(
    powerName: string,
    serverName: string,
    toolName: string,
    arguments_: any
  ): Promise<any> {
    // This is a placeholder - in a real Kiro environment, this would call the actual Kiro Powers
    // For now, we'll simulate the call by returning an error that triggers fallback
    throw new Error('Kiro Powers bridge not implemented - use direct Kiro Powers access');
  }
}

// Create singleton instance
export const kiroPowersBridge = new KiroPowersBridgeService();
export default kiroPowersBridge;