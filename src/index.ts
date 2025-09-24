#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import { getConfig, getAwsCliEnv, AthenaConfig } from './config.js';

class AthenaServer {
  private server: Server;
  private config: AthenaConfig;

  constructor() {
    this.config = getConfig();
    this.server = new Server(
      {
        name: 'aws-athena-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'query_athena',
            description: 'Execute an SQL query on S3 data using AWS Athena',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The SQL query to execute',
                },
                database: {
                  type: 'string',
                  description: 'The Athena database name (optional, defaults to "default")',
                },
                workgroup: {
                  type: 'string',
                  description: 'The Athena workgroup (optional, defaults to "primary")',
                },
                output_location: {
                  type: 'string',
                  description: 'S3 location for query results (required if not set in workgroup)',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'list_athena_databases',
            description: 'List available Athena databases',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'list_athena_tables',
            description: 'List tables in an Athena database',
            inputSchema: {
              type: 'object',
              properties: {
                database: {
                  type: 'string',
                  description: 'The database name (defaults to "default")',
                },
              },
            },
          },
          {
            name: 'describe_athena_table',
            description: 'Describe the schema of an Athena table',
            inputSchema: {
              type: 'object',
              properties: {
                table: {
                  type: 'string',
                  description: 'The table name',
                },
                database: {
                  type: 'string',
                  description: 'The database name (defaults to "default")',
                },
              },
              required: ['table'],
            },
          },
          {
            name: 'list_s3_buckets',
            description: 'List available S3 buckets',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'list_s3_objects',
            description: 'List objects in an S3 bucket',
            inputSchema: {
              type: 'object',
              properties: {
                bucket: {
                  type: 'string',
                  description: 'The S3 bucket name',
                },
                prefix: {
                  type: 'string',
                  description: 'Optional prefix to filter objects',
                },
                max_keys: {
                  type: 'number',
                  description: 'Maximum number of objects to return (default: 100)',
                },
              },
              required: ['bucket'],
            },
          },
          {
            name: 'get_aws_config',
            description: 'Get current AWS configuration and Athena settings',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'query_athena':
            return await this.executeAthenaQuery(args);
          case 'list_athena_databases':
            return await this.listAthenaDatabases();
          case 'list_athena_tables':
            return await this.listAthenaTables(args);
          case 'describe_athena_table':
            return await this.describeAthenaTable(args);
          case 'list_s3_buckets':
            return await this.listS3Buckets();
          case 'list_s3_objects':
            return await this.listS3Objects(args);
          case 'get_aws_config':
            return await this.getAwsConfig();
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new McpError(ErrorCode.InternalError, errorMessage);
      }
    });
  }

  private async executeAthenaQuery(args: any) {
    const { 
      query, 
      database = this.config.defaultDatabase, 
      workgroup = this.config.defaultWorkgroup, 
      output_location = this.config.defaultOutputLocation 
    } = args;

    let cmd = `aws athena start-query-execution --query-string "${query.replace(/"/g, '\\"')}" --query-execution-context Database=${database} --work-group ${workgroup}`;
    
    if (output_location) {
      cmd += ` --result-configuration OutputLocation=${output_location}`;
    }

    try {
      const result = execSync(cmd, { encoding: 'utf8', env: getAwsCliEnv(this.config) });
      const queryExecution = JSON.parse(result);
      const queryExecutionId = queryExecution.QueryExecutionId;

      let status = 'RUNNING';
      let attempts = 0;
      const maxAttempts = 60;

      while (status === 'RUNNING' || status === 'QUEUED') {
        if (attempts >= maxAttempts) {
          throw new Error('Query execution timeout');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusCmd = `aws athena get-query-execution --query-execution-id ${queryExecutionId}`;
        const statusResult = execSync(statusCmd, { encoding: 'utf8', env: getAwsCliEnv(this.config) });
        const statusData = JSON.parse(statusResult);
        status = statusData.QueryExecution.Status.State;
        attempts++;
      }

      if (status === 'SUCCEEDED') {
        const resultsCmd = `aws athena get-query-results --query-execution-id ${queryExecutionId}`;
        const resultsOutput = execSync(resultsCmd, { encoding: 'utf8', env: getAwsCliEnv(this.config) });
        const resultsData = JSON.parse(resultsOutput);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resultsData.ResultSet, null, 2),
            },
          ],
        };
      } else {
        throw new Error(`Query failed with status: ${status}`);
      }
    } catch (error) {
      throw new Error(`AWS CLI error: ${error}`);
    }
  }

  private async listAthenaDatabases() {
    try {
      const cmd = `aws athena list-databases --catalog-name ${this.config.defaultCatalog}`;
      const result = execSync(cmd, { encoding: 'utf8', env: getAwsCliEnv(this.config) });
      const data = JSON.parse(result);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data.DatabaseList, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`AWS CLI error: ${error}`);
    }
  }

  private async listAthenaTables(args: any) {
  const { database = this.config.defaultDatabase } = args;

  if (!database) {
    throw new Error('Database name is required but not provided or configured');
  }

  try {
    // Fixed: Removed the extra quotes and newline in the command
    const cmd = `aws athena list-table-metadata --catalog-name "${this.config.defaultCatalog}" --database-name "${database}" --query "TableMetadataList[].Name" --output json`;
    
    console.error(`Executing command: ${cmd}`);
    
    const result = execSync(cmd, { 
      encoding: 'utf8', 
      env: getAwsCliEnv(this.config),
      stdio: ['inherit', 'pipe', 'pipe']
    });

    // Parse the JSON result (should be an array of table names)
    const tableNames = JSON.parse(result);

    // Return proper MCP response format
    return {
      content: [
        {
          type: 'text',
          text: `Tables in database "${database}":\n${tableNames.map((name: string) => `- ${name}`).join('\n')}`,
        },
      ],
    };
  } catch (error: any) {
    const errorMessage = error.stderr || error.stdout || error.message || String(error);
    console.error(`AWS CLI error details: ${errorMessage}`);
    throw new Error(`Failed to list Athena tables: ${errorMessage}`);
  }
}

  private async describeAthenaTable(args: any) {
    const { table, database = this.config.defaultDatabase } = args;

    try {
      const cmd = `aws athena get-table-metadata --catalog-name ${this.config.defaultCatalog} --database-name ${database} --table-name ${table}`;
      const result = execSync(cmd, { encoding: 'utf8', env: getAwsCliEnv(this.config) });
      const data = JSON.parse(result);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data.TableMetadata, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`AWS CLI error: ${error}`);
    }
  }

  private async listS3Buckets() {
    try {
      const cmd = 'aws s3api list-buckets';
      const result = execSync(cmd, { encoding: 'utf8', env: getAwsCliEnv(this.config) });
      const data = JSON.parse(result);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data.Buckets, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`AWS CLI error: ${error}`);
    }
  }

  private async listS3Objects(args: any) {
    const { bucket, prefix, max_keys = 100 } = args;

    try {
      let cmd = `aws s3api list-objects-v2 --bucket ${bucket} --max-items ${max_keys}`;
      if (prefix) {
        cmd += ` --prefix ${prefix}`;
      }
      
      const result = execSync(cmd, { encoding: 'utf8', env: getAwsCliEnv(this.config) });
      const data = JSON.parse(result);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data.Contents || [], null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`AWS CLI error: ${error}`);
    }
  }

  private async getAwsConfig() {
    const configInfo = {
      region: this.config.awsRegion,
      defaultCatalog: this.config.defaultCatalog,
      defaultDatabase: this.config.defaultDatabase,
      defaultWorkgroup: this.config.defaultWorkgroup,
      defaultOutputLocation: this.config.defaultOutputLocation,
      hasAwsCredentials: !!(this.config.awsAccessKeyId && this.config.awsSecretAccessKey),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(configInfo, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('AWS Athena MCP server running on stdio');
  }
}

const server = new AthenaServer();
server.run().catch(console.error);