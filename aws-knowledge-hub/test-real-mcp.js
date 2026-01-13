const { realMcpClient } = require('./dist/services/mcpClient');

async function testRealMCPClient() {
  console.log('Testing Real MCP Client...\n');

  try {
    // Test connection
    console.log('1. Testing connection...');
    const connectionResult = await realMcpClient.testConnection();
    console.log('Connection result:', {
      success: connectionResult.success,
      status: connectionResult.data?.status,
      responseTime: connectionResult.responseTime
    });

    // Test search
    console.log('\n2. Testing search...');
    const searchResult = await realMcpClient.searchDocumentation('AWS Lambda', {
      topics: ['general'],
      limit: 3
    });
    console.log('Search result:', {
      success: searchResult.success,
      resultCount: searchResult.data?.length || 0,
      responseTime: searchResult.responseTime
    });

    if (searchResult.success && searchResult.data?.length > 0) {
      console.log('First result:', {
        title: searchResult.data[0].title,
        url: searchResult.data[0].url
      });
    }

    // Test health status
    console.log('\n3. Testing health status...');
    const healthStatus = await realMcpClient.getHealthStatus();
    console.log('Health status:', {
      connected: healthStatus.connected,
      lastCheck: healthStatus.lastCheck,
      serverInfo: healthStatus.serverInfo
    });

    // Test cache stats
    console.log('\n4. Testing cache stats...');
    const cacheStats = realMcpClient.getCacheStats();
    console.log('Cache stats:', cacheStats);

    // Test metrics
    console.log('\n5. Testing metrics...');
    const metrics = realMcpClient.getMetrics();
    console.log('Metrics:', {
      connectionHealthy: metrics.connectionHealthy,
      retryCount: metrics.retryCount,
      cacheEntries: metrics.cacheStats.totalEntries
    });

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRealMCPClient();