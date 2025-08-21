# AWS Athena MCP Server

A Model Context Protocol (MCP) server that enables querying S3 buckets using AWS Athena service through AWS CLI.

## Features

- Execute SQL queries on S3 data using AWS Athena
- List available Athena databases and tables
- Describe table schemas
- List S3 buckets and objects
- Get AWS configuration information
- Configurable AWS credentials and Athena settings
- Integration with Claude Desktop via MCP

## Prerequisites

- Node.js 18+ 
- AWS CLI configured with appropriate credentials
- AWS Athena access and configured workgroups

## Installation

```bash
npm install
npm run build
```

## Usage

### With Claude Desktop

Add the following to your Claude Desktop MCP configuration:

#### Basic Configuration
```json
{
  "mcpServers": {
    "aws-athena": {
      "command": "node",
      "args": ["/path/to/aws-athena-mcp/dist/index.js"]
    }
  }
}
```

#### Configuration with AWS Credentials and Settings
```json
{
  "mcpServers": {
    "aws-athena": {
      "command": "node",
      "args": ["/path/to/aws-athena-mcp/dist/index.js"],
      "env": {
        "AWS_ACCESS_KEY_ID": "your-access-key-id",
        "AWS_SECRET_ACCESS_KEY": "your-secret-access-key",
        "AWS_REGION": "us-east-1",
        "ATHENA_CATALOG": "AwsDataCatalog",
        "ATHENA_DATABASE": "default",
        "ATHENA_WORKGROUP": "primary",
        "ATHENA_OUTPUT_LOCATION": "s3://your-results-bucket/query-results/"
      }
    }
  }
}
```

#### Configuration with AWS Profile
```json
{
  "mcpServers": {
    "aws-athena": {
      "command": "node",
      "args": ["/path/to/aws-athena-mcp/dist/index.js"],
      "env": {
        "AWS_PROFILE": "your-aws-profile",
        "AWS_REGION": "us-east-1",
        "ATHENA_DATABASE": "my_database",
        "ATHENA_WORKGROUP": "my_workgroup"
      }
    }
  }
}
```

### Available Tools

1. **query_athena** - Execute SQL queries on S3 data
   - `query`: SQL query string (required)
   - `database`: Athena database name (optional, uses configured default)
   - `workgroup`: Athena workgroup (optional, uses configured default)
   - `output_location`: S3 location for results (optional, uses configured default)

2. **list_athena_databases** - List available databases

3. **list_athena_tables** - List tables in a database
   - `database`: Database name (optional, uses configured default)

4. **describe_athena_table** - Get table schema information
   - `table`: Table name (required)
   - `database`: Database name (optional, uses configured default)

5. **list_s3_buckets** - List available S3 buckets

6. **list_s3_objects** - List objects in an S3 bucket
   - `bucket`: S3 bucket name (required)
   - `prefix`: Optional prefix to filter objects
   - `max_keys`: Maximum number of objects to return (default: 100)

7. **get_aws_config** - Get current AWS configuration and Athena settings

## Configuration

### Environment Variables

The server supports the following environment variables:

- `AWS_ACCESS_KEY_ID`: AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key
- `AWS_SESSION_TOKEN`: AWS session token (for temporary credentials)
- `AWS_REGION`: AWS region (default: us-east-1)
- `AWS_PROFILE`: AWS CLI profile to use
- `ATHENA_CATALOG`: Athena catalog name (default: AwsDataCatalog)
- `ATHENA_DATABASE`: Default database for queries (default: default)
- `ATHENA_WORKGROUP`: Default workgroup for queries (default: primary)
- `ATHENA_OUTPUT_LOCATION`: Default S3 location for query results

### AWS Configuration

Ensure your AWS configuration includes:
- Valid AWS credentials (via environment variables, AWS profile, or IAM role)
- Appropriate IAM permissions for Athena and S3
- Access to S3 buckets you want to query

### Required IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "athena:StartQueryExecution",
        "athena:GetQueryExecution",
        "athena:GetQueryResults",
        "athena:ListDatabases",
        "athena:ListTableMetadata",
        "athena:GetTableMetadata",
        "s3:ListAllMyBuckets",
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "glue:GetDatabase",
        "glue:GetDatabases",
        "glue:GetTable",
        "glue:GetTables"
      ],
      "Resource": "*"
    }
  ]
}
```

## Development

```bash
# Build the project
npm run build

# Watch mode for development
npm run dev

# Clean build artifacts
npm run clean
```

## Examples

### Query S3 Data
```sql
SELECT * FROM my_table 
WHERE date_partition = '2024-01-01' 
LIMIT 10;
```

### List Buckets and Objects
Use the `list_s3_buckets` tool to see available buckets, then `list_s3_objects` to explore bucket contents.

### Check Configuration
Use the `get_aws_config` tool to verify your current AWS and Athena configuration settings.