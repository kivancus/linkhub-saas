import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';

export interface DatabaseConfig {
  path: string;
  readonly?: boolean;
  verbose?: boolean;
  timeout?: number;
}

class DatabaseManager {
  private db: Database.Database | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Initialize database connection and create tables
   */
  public async initialize(): Promise<void> {
    try {
      // Create database connection
      this.db = new Database(this.config.path, {
        readonly: this.config.readonly || false,
        verbose: this.config.verbose ? logger.debug.bind(logger) : undefined,
        timeout: this.config.timeout || 5000,
      });

      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      
      // Enable foreign key constraints
      this.db.pragma('foreign_keys = ON');
      
      // Set synchronous mode for better performance
      this.db.pragma('synchronous = NORMAL');

      // Create tables from schema
      await this.createTables();
      
      logger.info('Database initialized successfully', {
        path: this.config.path,
        mode: this.config.readonly ? 'readonly' : 'readwrite',
      });
    } catch (error) {
      logger.error('Failed to initialize database', { error: getErrorMessage(error) });
      throw error;
    }
  }

  /**
   * Create database tables from schema file
   */
  private async createTables(): Promise<void> {
    try {
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      // Split schema into individual statements and execute
      const statements = schema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        this.db!.exec(statement);
      }

      logger.info('Database tables created successfully');
    } catch (error) {
      logger.error('Failed to create database tables', { error: getErrorMessage(error) });
      throw error;
    }
  }

  /**
   * Get database instance
   */
  public getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Close database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Database connection closed');
    }
  }

  /**
   * Check if database is connected
   */
  public isConnected(): boolean {
    return this.db !== null && this.db.open;
  }

  /**
   * Run database health check
   */
  public healthCheck(): { status: string; details: any } {
    try {
      if (!this.isConnected()) {
        return { status: 'error', details: { message: 'Database not connected' } };
      }

      // Test query
      const result = this.db!.prepare('SELECT 1 as test').get();
      
      // Get database info
      const info = {
        connected: true,
        readonly: this.config.readonly,
        path: this.config.path,
        inTransaction: this.db!.inTransaction,
        memory: this.db!.memory,
      };

      return { status: 'healthy', details: info };
    } catch (error) {
      return { 
        status: 'error', 
        details: { message: getErrorMessage(error) } 
      };
    }
  }

  /**
   * Execute a transaction
   */
  public transaction<T>(fn: (db: Database.Database) => T): T {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    const transaction = this.db.transaction(fn);
    return transaction(this.db);
  }

  /**
   * Backup database to file
   */
  public backup(backupPath: string): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      this.db.backup(backupPath);
      logger.info('Database backup created', { backupPath });
    } catch (error) {
      logger.error('Database backup failed', { error: getErrorMessage(error), backupPath });
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  public getStats(): any {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stats = {
        sessions: this.db.prepare('SELECT COUNT(*) as count FROM sessions').get(),
        conversations: this.db.prepare('SELECT COUNT(*) as count FROM conversations').get(),
        cache_entries: this.db.prepare('SELECT COUNT(*) as count FROM documentation_cache').get(),
        analytics_entries: this.db.prepare('SELECT COUNT(*) as count FROM search_analytics').get(),
        aws_services: this.db.prepare('SELECT COUNT(*) as count FROM aws_services').get(),
        suggestions: this.db.prepare('SELECT COUNT(*) as count FROM question_suggestions').get(),
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get database stats', { error: getErrorMessage(error) });
      throw error;
    }
  }
}

// Create singleton instance
const dbConfig: DatabaseConfig = {
  path: process.env.DATABASE_PATH || './data/knowledge-hub.db',
  readonly: false,
  verbose: process.env.NODE_ENV === 'development',
  timeout: 10000,
};

export const databaseManager = new DatabaseManager(dbConfig);
export default databaseManager;