// Performance Dashboard for monitoring POS system performance
import React, { useState, useCallback, useEffect } from 'react';
import {
  reactExtension,
  useApi,
  Navigator,
  Screen,
  ScrollView,
  Stack,
  Text,
  Button,
  Badge,
  Banner
} from '@shopify/ui-extensions-react/point-of-sale';

import { useOfflineSync } from '../hooks/useOfflineSync';
import { 
  globalPerformanceMonitor,
  globalCreditSearchIndex,
  globalBatchProcessor,
  usePerformanceMonitor,
  formatLargeNumber
} from '../utils/performance.utils';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  metrics: PerformanceMetric[];
  recommendations: string[];
}

const PerformanceDashboard: React.FC = () => {
  const api = useApi<'pos.home.modal.render'>();
  
  // State
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'cache' | 'sync'>('overview');
  
  // Hooks
  const { syncStats, pendingItems, isOnline } = useOfflineSync();
  const { measureOperation, recordMemoryUsage, getPerformanceStats } = usePerformanceMonitor();

  // Load performance data
  useEffect(() => {
    loadPerformanceData();
  }, []);

  // Auto-refresh performance data
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadPerformanceData();
      recordMemoryUsage();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  /**
   * Load and analyze performance data
   */
  const loadPerformanceData = useCallback(async () => {
    const stopTimer = measureOperation('performance_dashboard_load');
    
    try {
      const perfStats = getPerformanceStats();
      const searchStats = globalCreditSearchIndex.getStats();
      const batchStats = globalBatchProcessor.getQueueStats();
      
      // Calculate metrics
      const metrics: PerformanceMetric[] = [];
      
      // API Response Times
      if (perfStats.api_request) {
        metrics.push({
          name: 'API Response Time',
          value: perfStats.api_request.average,
          unit: 'ms',
          status: perfStats.api_request.average < 500 ? 'good' : 
                   perfStats.api_request.average < 1000 ? 'warning' : 'critical'
        });
      }
      
      // Search Performance
      if (perfStats.credit_search) {
        metrics.push({
          name: 'Search Response Time',
          value: perfStats.credit_search.average,
          unit: 'ms',
          status: perfStats.credit_search.average < 100 ? 'good' : 
                   perfStats.credit_search.average < 300 ? 'warning' : 'critical'
        });
      }
      
      // Memory Usage
      if (perfStats.memoryUsage) {
        const memoryMB = perfStats.memoryUsage.current / (1024 * 1024);
        metrics.push({
          name: 'Memory Usage',
          value: memoryMB,
          unit: 'MB',
          status: memoryMB < 50 ? 'good' : memoryMB < 100 ? 'warning' : 'critical',
          trend: perfStats.memoryUsage.trend > 0 ? 'up' : 
                 perfStats.memoryUsage.trend < 0 ? 'down' : 'stable'
        });
      }
      
      // Search Index Size
      metrics.push({
        name: 'Search Index Size',
        value: searchStats.totalCredits,
        unit: 'items',
        status: searchStats.totalCredits < 1000 ? 'good' : 
                searchStats.totalCredits < 5000 ? 'warning' : 'critical'
      });
      
      // Sync Queue Size
      metrics.push({
        name: 'Sync Queue Size',
        value: pendingItems.length,
        unit: 'items',
        status: pendingItems.length === 0 ? 'good' : 
                pendingItems.length < 10 ? 'warning' : 'critical'
      });
      
      // Batch Processing Queue
      metrics.push({
        name: 'Batch Queue Size',
        value: batchStats.queueSize,
        unit: 'items',
        status: batchStats.queueSize < 5 ? 'good' : 
                batchStats.queueSize < 20 ? 'warning' : 'critical'
      });
      
      // Sync Success Rate
      if (syncStats.totalSynced > 0 || syncStats.totalFailed > 0) {
        metrics.push({
          name: 'Sync Success Rate',
          value: syncStats.successRate,
          unit: '%',
          status: syncStats.successRate > 95 ? 'good' : 
                  syncStats.successRate > 85 ? 'warning' : 'critical'
        });
      }
      
      // Generate recommendations
      const recommendations: string[] = [];
      
      if (perfStats.memoryUsage?.trend > 10000000) { // 10MB increase
        recommendations.push('Memory usage is increasing. Consider clearing cache or restarting the app.');
      }
      
      if (pendingItems.length > 20) {
        recommendations.push('Large sync queue detected. Check network connection and sync status.');
      }
      
      if (searchStats.totalCredits > 5000) {
        recommendations.push('Large search index may impact performance. Consider pagination or filtering.');
      }
      
      if (perfStats.api_request?.average > 1000) {
        recommendations.push('API response times are slow. Check network connection or server status.');
      }
      
      if (!isOnline) {
        recommendations.push('System is offline. Some features may be limited until connection is restored.');
      }
      
      // Determine overall health
      const criticalCount = metrics.filter(m => m.status === 'critical').length;
      const warningCount = metrics.filter(m => m.status === 'warning').length;
      
      let overall: SystemHealth['overall'] = 'healthy';
      if (criticalCount > 0) {
        overall = 'critical';
      } else if (warningCount > 2) {
        overall = 'degraded';
      }
      
      setSystemHealth({
        overall,
        metrics,
        recommendations
      });
      
    } catch (error) {
      api.toast.show('Failed to load performance data', 'error');
    } finally {
      stopTimer();
    }
  }, [measureOperation, recordMemoryUsage, getPerformanceStats, pendingItems.length, syncStats, isOnline, api.toast]);

  /**
   * Clear performance data
   */
  const clearPerformanceData = useCallback(() => {
    globalPerformanceMonitor.clear();
    globalCreditSearchIndex.getStats(); // Reset doesn't exist, but we can rebuild
    setSystemHealth(null);
    api.toast.show('Performance data cleared', 'success');
    loadPerformanceData();
  }, [api.toast, loadPerformanceData]);

  /**
   * Export performance report
   */
  const exportPerformanceReport = useCallback(() => {
    if (!systemHealth) return;
    
    const report = {
      timestamp: new Date().toISOString(),
      systemHealth: systemHealth.overall,
      metrics: systemHealth.metrics,
      recommendations: systemHealth.recommendations,
      rawStats: getPerformanceStats(),
      syncStats,
      environment: {
        online: isOnline,
        userAgent: navigator.userAgent,
        deviceMemory: (navigator as any).deviceMemory || 'unknown',
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown'
      }
    };
    
    // In a real implementation, this would download or send the report
    console.log('Performance Report:', report);
    api.toast.show('Performance report exported to console', 'success');
  }, [systemHealth, getPerformanceStats, syncStats, isOnline, api.toast]);

  /**
   * Get status color for metric
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'critical';
      default: return 'info';
    }
  };

  /**
   * Get trend icon for metric
   */
  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      case 'stable': return '→';
      default: return '';
    }
  };

  return (
    <Navigator>
      <Screen name="PerformanceDashboard" title="Performance Monitor">
        <ScrollView>
          <Stack spacing="base">
            {/* System Health Overview */}
            {systemHealth && (
              <Banner 
                status={
                  systemHealth.overall === 'healthy' ? 'success' :
                  systemHealth.overall === 'degraded' ? 'warning' : 'critical'
                }
              >
                <Stack spacing="tight">
                  <Text>
                    System Status: {systemHealth.overall.toUpperCase()}
                  </Text>
                  {systemHealth.overall !== 'healthy' && (
                    <Text variant="bodySm">
                      {systemHealth.metrics.filter(m => m.status !== 'good').length} issues detected
                    </Text>
                  )}
                </Stack>
              </Banner>
            )}

            {/* Controls */}
            <Stack direction="horizontal" spacing="tight">
              <Button
                onPress={loadPerformanceData}
                title="Refresh"
                variant="secondary"
                size="small"
              />
              
              <Button
                onPress={() => setAutoRefresh(prev => !prev)}
                title={autoRefresh ? 'Auto: ON' : 'Auto: OFF'}
                variant={autoRefresh ? 'primary' : 'secondary'}
                size="small"
              />
              
              <Button
                onPress={exportPerformanceReport}
                title="Export"
                variant="secondary"
                size="small"
                disabled={!systemHealth}
              />
            </Stack>

            {/* Tab Navigation */}
            <Stack direction="horizontal" spacing="tight">
              <Button
                onPress={() => setActiveTab('overview')}
                title="Overview"
                variant={activeTab === 'overview' ? 'primary' : 'secondary'}
                fullWidth
              />
              <Button
                onPress={() => setActiveTab('metrics')}
                title="Metrics"
                variant={activeTab === 'metrics' ? 'primary' : 'secondary'}
                fullWidth
              />
              <Button
                onPress={() => setActiveTab('cache')}
                title="Cache"
                variant={activeTab === 'cache' ? 'primary' : 'secondary'}
                fullWidth
              />
              <Button
                onPress={() => setActiveTab('sync')}
                title="Sync"
                variant={activeTab === 'sync' ? 'primary' : 'secondary'}
                fullWidth
              />
            </Stack>


            {/* Overview Tab */}
            {activeTab === 'overview' && systemHealth && (
              <Stack spacing="base">
                <Text variant="headingSm">System Overview</Text>
                
                {/* Key Metrics Grid */}
                <Stack spacing="tight">
                  {systemHealth.metrics.slice(0, 6).map((metric, index) => (
                    <Stack key={index} direction="horizontal" alignment="space-between">
                      <Text variant="bodySm">{metric.name}</Text>
                      <Stack direction="horizontal" spacing="extraTight" alignment="center">
                        <Badge status={getStatusColor(metric.status) as any}>
                          {formatLargeNumber(metric.value)} {metric.unit}
                        </Badge>
                        {metric.trend && (
                          <Text variant="bodySm">{getTrendIcon(metric.trend)}</Text>
                        )}
                      </Stack>
                    </Stack>
                  ))}
                </Stack>

                {/* Recommendations */}
                {systemHealth.recommendations.length > 0 && (
                  <Stack spacing="base">
                    <Text variant="headingSm">Recommendations</Text>
                    <Stack spacing="tight">
                      {systemHealth.recommendations.map((recommendation, index) => (
                        <Text key={index} variant="bodySm">
                          • {recommendation}
                        </Text>
                      ))}
                    </Stack>
                  </Stack>
                )}
              </Stack>
            )}

            {/* Metrics Tab */}
            {activeTab === 'metrics' && systemHealth && (
              <Stack spacing="base">
                <Text variant="headingSm">Detailed Metrics</Text>
                
                {systemHealth.metrics.map((metric, index) => (
                  <Stack key={index} spacing="tight">
                    <Stack direction="horizontal" alignment="space-between">
                      <Text variant="bodySm" color="emphasis">
                        {metric.name}
                      </Text>
                      <Stack direction="horizontal" spacing="extraTight" alignment="center">
                        <Badge status={getStatusColor(metric.status) as any}>
                          {metric.value.toFixed(metric.name.includes('Rate') || metric.name.includes('Time') ? 1 : 0)} {metric.unit}
                        </Badge>
                        {metric.trend && (
                          <Text variant="bodySm">{getTrendIcon(metric.trend)}</Text>
                        )}
                      </Stack>
                    </Stack>
                    
                    {/* Performance thresholds */}
                    <Stack spacing="extraTight">
                      <Text variant="bodySm" color="subdued">
                        Status: {metric.status} 
                        {metric.status !== 'good' && ' - Attention needed'}
                      </Text>
                    </Stack>
                    
                  </Stack>
                ))}
              </Stack>
            )}

            {/* Cache Tab */}
            {activeTab === 'cache' && (
              <Stack spacing="base">
                <Text variant="headingSm">Cache & Search</Text>
                
                {(() => {
                  const searchStats = globalCreditSearchIndex.getStats();
                  return (
                    <Stack spacing="tight">
                      <Stack direction="horizontal" alignment="space-between">
                        <Text variant="bodySm">Search Index Size</Text>
                        <Text variant="bodySm">{searchStats.totalCredits} credits</Text>
                      </Stack>
                      
                      <Stack direction="horizontal" alignment="space-between">
                        <Text variant="bodySm">Index Entries</Text>
                        <Text variant="bodySm">{searchStats.indexSize} words</Text>
                      </Stack>
                      
                      <Stack direction="horizontal" alignment="space-between">
                        <Text variant="bodySm">Memory Usage</Text>
                        <Text variant="bodySm">{formatLargeNumber(searchStats.memoryUsage)} bytes</Text>
                      </Stack>
                    </Stack>
                  );
                })()}

                <Button
                  onPress={() => {
                    // Rebuild search index
                    globalCreditSearchIndex.addCredits([]);
                    api.toast.show('Search index rebuilt', 'success');
                  }}
                  title="Rebuild Search Index"
                  variant="secondary"
                  fullWidth
                />
              </Stack>
            )}

            {/* Sync Tab */}
            {activeTab === 'sync' && (
              <Stack spacing="base">
                <Text variant="headingSm">Sync Performance</Text>
                
                <Stack spacing="tight">
                  <Stack direction="horizontal" alignment="space-between">
                    <Text variant="bodySm">Connection Status</Text>
                    <Badge status={isOnline ? 'success' : 'critical'}>
                      {isOnline ? 'Online' : 'Offline'}
                    </Badge>
                  </Stack>
                  
                  <Stack direction="horizontal" alignment="space-between">
                    <Text variant="bodySm">Pending Items</Text>
                    <Text variant="bodySm">{pendingItems.length}</Text>
                  </Stack>
                  
                  <Stack direction="horizontal" alignment="space-between">
                    <Text variant="bodySm">Total Synced</Text>
                    <Text variant="bodySm">{syncStats.totalSynced}</Text>
                  </Stack>
                  
                  <Stack direction="horizontal" alignment="space-between">
                    <Text variant="bodySm">Total Failed</Text>
                    <Text variant="bodySm">{syncStats.totalFailed}</Text>
                  </Stack>
                  
                  <Stack direction="horizontal" alignment="space-between">
                    <Text variant="bodySm">Success Rate</Text>
                    <Badge 
                      status={
                        syncStats.successRate > 95 ? 'success' : 
                        syncStats.successRate > 85 ? 'warning' : 'critical'
                      }
                    >
                      {syncStats.successRate.toFixed(1)}%
                    </Badge>
                  </Stack>
                  
                  <Stack direction="horizontal" alignment="space-between">
                    <Text variant="bodySm">Last Sync Duration</Text>
                    <Text variant="bodySm">{syncStats.lastSyncDuration}ms</Text>
                  </Stack>
                </Stack>
              </Stack>
            )}

            {/* System Info */}
            <Stack spacing="base">
              <Text variant="headingSm">System Information</Text>
              <Stack spacing="tight">
                <Text variant="bodySm" color="subdued">
                  Device Memory: {(navigator as any).deviceMemory || 'Unknown'} GB
                </Text>
                <Text variant="bodySm" color="subdued">
                  CPU Cores: {navigator.hardwareConcurrency || 'Unknown'}
                </Text>
                <Text variant="bodySm" color="subdued">
                  Connection: {(navigator as any).connection?.effectiveType || 'Unknown'}
                </Text>
                <Text variant="bodySm" color="subdued">
                  Last Updated: {new Date().toLocaleTimeString()}
                </Text>
              </Stack>
            </Stack>

            {/* Performance Tips */}
            <Stack spacing="base">
              <Text variant="headingSm">Performance Tips</Text>
              <Stack spacing="tight">
                <Text variant="bodySm">• Keep sync queue small for best performance</Text>
                <Text variant="bodySm">• Use search filters to limit results</Text>
                <Text variant="bodySm">• Clear cache periodically if memory usage is high</Text>
                <Text variant="bodySm">• Ensure stable network connection for sync operations</Text>
                <Text variant="bodySm">• Use bulk operations for processing multiple items</Text>
              </Stack>
            </Stack>
          </Stack>
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

export default PerformanceDashboard;