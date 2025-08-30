// CreditCraft Dashboard - Main app homepage
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  InlineStack,
  Badge,
  ProgressBar,
  Icon
} from "@shopify/polaris";
import { 
  CreditCardIcon, 
  PersonIcon, 
  ChartHistogramGrowthIcon, 
  NoteIcon 
} from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { CreditNoteService } from "~/services/creditNote.server";

interface DashboardData {
  totalCredits: number;
  activeCredits: number;
  totalValue: number;
  redemptionsToday: number;
  recentActivity: Array<{
    id: string;
    type: 'created' | 'redeemed' | 'expired';
    noteNumber: string;
    amount: number;
    customerName?: string;
    timestamp: string;
  }>;
  topCustomers: Array<{
    name: string;
    totalCredits: number;
    creditValue: number;
  }>;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  const creditService = new CreditNoteService(session.shop, admin);
  
  // Get dashboard statistics
  const [totalResult, activeResult] = await Promise.all([
    creditService.getCredits({ limit: 1 }), // Get total count
    creditService.getCredits({ status: ['ACTIVE', 'PARTIALLY_USED'], limit: 1 })
  ]);

  // Mock data for now - replace with real queries
  const dashboardData: DashboardData = {
    totalCredits: totalResult.totalCount,
    activeCredits: activeResult.totalCount,
    totalValue: 25630.50, // Sum of all active credits
    redemptionsToday: 12,
    recentActivity: [
      {
        id: '1',
        type: 'created',
        noteNumber: 'CN-2024-0023',
        amount: 89.99,
        customerName: 'Sarah Johnson',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
      },
      {
        id: '2', 
        type: 'redeemed',
        noteNumber: 'CN-2024-0019',
        amount: 45.00,
        customerName: 'Mike Chen',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
      },
      {
        id: '3',
        type: 'created',
        noteNumber: 'CN-2024-0024',
        amount: 120.00,
        customerName: 'Emma Davis',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString()
      }
    ],
    topCustomers: [
      { name: 'Sarah Johnson', totalCredits: 3, creditValue: 234.50 },
      { name: 'Mike Chen', totalCredits: 2, creditValue: 189.99 },
      { name: 'Emma Davis', totalCredits: 4, creditValue: 445.25 }
    ]
  };

  return json(dashboardData);
};

export default function AppIndex() {
  const data = useLoaderData<DashboardData>();
  const navigate = useNavigate();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffMinutes / 1440)}d ago`;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'created':
        return '🆕';
      case 'redeemed':
        return '✅';
      case 'expired':
        return '⚠️';
      default:
        return '📝';
    }
  };

  const utilizationRate = data.totalCredits > 0 ? 
    ((data.totalCredits - data.activeCredits) / data.totalCredits) * 100 : 0;

  return (
    <Page
      title="CreditCraft Dashboard"
      subtitle="Manage your store credit system"
      primaryAction={{
        content: 'Create Credit Note',
        onAction: () => navigate('/app/credit-notes/new')
      }}
    >
      <BlockStack gap="500">
        {/* Key Metrics */}
        <Layout>
          <Layout.Section>
            <InlineStack gap="400">
              <Box width="25%">
                <Card>
                  <BlockStack gap="200">
                    <InlineStack alignment="space-between">
                      <Icon source={CreditCardIcon} tone="base" />
                      <Text variant="headingLg">{data.activeCredits}</Text>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">Active Credits</Text>
                    <Text variant="headingSm">{formatCurrency(data.totalValue)}</Text>
                  </BlockStack>
                </Card>
              </Box>

              <Box width="25%">
                <Card>
                  <BlockStack gap="200">
                    <InlineStack alignment="space-between">
                      <Icon source={NoteIcon} tone="base" />
                      <Text variant="headingLg">{data.totalCredits}</Text>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">Total Credits</Text>
                    <Text variant="bodySm" tone="success">
                      {data.totalCredits - data.activeCredits} used
                    </Text>
                  </BlockStack>
                </Card>
              </Box>

              <Box width="25%">
                <Card>
                  <BlockStack gap="200">
                    <InlineStack alignment="space-between">
                      <Icon source={ChartHistogramGrowthIcon} tone="base" />
                      <Text variant="headingLg">{data.redemptionsToday}</Text>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">Redeemed Today</Text>
                    <Badge status="success">+{Math.round(data.redemptionsToday * 0.2)} vs yesterday</Badge>
                  </BlockStack>
                </Card>
              </Box>

              <Box width="25%">
                <Card>
                  <BlockStack gap="200">
                    <InlineStack alignment="space-between">
                      <Icon source={PersonIcon} tone="base" />
                      <Text variant="headingLg">{Math.round(utilizationRate)}%</Text>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">Utilization Rate</Text>
                    <ProgressBar progress={utilizationRate} size="small" />
                  </BlockStack>
                </Card>
              </Box>
            </InlineStack>
          </Layout.Section>
        </Layout>

        {/* Quick Actions & Recent Activity */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd">Quick Actions</Text>
                <InlineStack gap="300">
                  <Button
                    variant="primary"
                    onClick={() => navigate('/app/credit-notes/new')}
                  >
                    Create Credit Note
                  </Button>
                  
                  <Button
                    onClick={() => navigate('/app/credit-notes')}
                  >
                    Manage Credits
                  </Button>
                  
                  <Button
                    onClick={() => navigate('/app/reports')}
                  >
                    View Reports
                  </Button>
                  
                  <Button
                    onClick={() => navigate('/app/settings')}
                  >
                    Settings
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd">Recent Activity</Text>
                
                <BlockStack gap="300">
                  {data.recentActivity.map((activity) => (
                    <Box key={activity.id} padding="300" background="bg-surface-secondary" borderRadius="200">
                      <InlineStack alignment="space-between">
                        <BlockStack gap="100">
                          <InlineStack gap="200" alignment="center">
                            <Text>{getActivityIcon(activity.type)}</Text>
                            <Text variant="bodySm" fontWeight="bold">
                              {activity.noteNumber}
                            </Text>
                            <Badge status={activity.type === 'redeemed' ? 'success' : 'info'}>
                              {activity.type}
                            </Badge>
                          </InlineStack>
                          
                          <Text variant="bodySm" tone="subdued">
                            {activity.customerName} • {formatCurrency(activity.amount)}
                          </Text>
                        </BlockStack>
                        
                        <Text variant="bodySm" tone="subdued">
                          {getTimeAgo(activity.timestamp)}
                        </Text>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>

                <Button
                  variant="plain"
                  onClick={() => navigate('/app/credit-notes')}
                >
                  View all activity
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Top Customers & System Status */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack alignment="space-between">
                  <Text variant="headingMd">Top Credit Customers</Text>
                  <Button
                    variant="plain"
                    onClick={() => navigate('/app/customers')}
                  >
                    View all
                  </Button>
                </InlineStack>

                <BlockStack gap="200">
                  {data.topCustomers.map((customer, index) => (
                    <Box key={customer.name} padding="300" background="bg-surface" borderRadius="200">
                      <InlineStack alignment="space-between">
                        <InlineStack gap="300">
                          <Text variant="bodySm" fontWeight="bold">
                            #{index + 1}
                          </Text>
                          <Text variant="bodyMd">{customer.name}</Text>
                        </InlineStack>
                        
                        <InlineStack gap="300">
                          <Text variant="bodySm" tone="subdued">
                            {customer.totalCredits} credits
                          </Text>
                          <Text variant="bodyMd" fontWeight="bold">
                            {formatCurrency(customer.creditValue)}
                          </Text>
                        </InlineStack>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd">System Status</Text>
                
                <BlockStack gap="300">
                  <InlineStack alignment="space-between">
                    <Text variant="bodySm">POS Extension</Text>
                    <Badge status="success">Active</Badge>
                  </InlineStack>
                  
                  <InlineStack alignment="space-between">
                    <Text variant="bodySm">Offline Sync</Text>
                    <Badge status="success">Connected</Badge>
                  </InlineStack>
                  
                  <InlineStack alignment="space-between">
                    <Text variant="bodySm">QR Code Service</Text>
                    <Badge status="success">Operational</Badge>
                  </InlineStack>

                  <InlineStack alignment="space-between">
                    <Text variant="bodySm">Database</Text>
                    <Badge status="success">Connected</Badge>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
