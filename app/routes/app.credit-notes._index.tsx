// Main credit notes admin interface
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useNavigate, useSubmit } from '@remix-run/react';
import {
  Card,
  EmptyState,
  Layout,
  Page,
  IndexTable,
  Text,
  Badge,
  Button,
  ButtonGroup,
  Filters,
  ChoiceList,
  RangeSlider,
  TextField,
  useIndexResourceState,
  IndexFilters,
  useSetIndexFiltersMode,
  Tabs,
  Box,
  InlineStack,
  BlockStack,
  Pagination
} from '@shopify/polaris';
import { useState, useCallback } from 'react';
import { authenticate } from '../shopify.server';

interface CreditNote {
  id: string;
  noteNumber: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  originalAmount: number;
  remainingAmount: number;
  currency: string;
  status: string;
  reason?: string;
  createdAt: string;
  expiresAt?: string;
  qrCodeImage: string;
}

interface LoaderData {
  creditNotes: CreditNote[];
  totalCount: number;
  hasMore: boolean;
  filters: {
    status?: string;
    dateRange?: string;
    amountRange?: [number, number];
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  
  // Return empty data for now to get authentication working
  return json({
    creditNotes: [],
    totalCount: 0,
    hasMore: false,
    filters: {}
  });
}

export default function CreditNotesIndex() {
  const { creditNotes, totalCount, hasMore, filters } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const submit = useSubmit();

  // State
  const [selectedTab, setSelectedTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [amountRange, setAmountRange] = useState<[number, number]>([0, 10000]);
  const [sortValue, setSortValue] = useState('created_desc');

  // Index table state
  const resourceName = { singular: 'credit note', plural: 'credit notes' };
  const { selectedResources, allResourcesSelected, handleSelectionChange } = 
    useIndexResourceState(creditNotes);

  // Filter mode
  const { mode, setMode } = useSetIndexFiltersMode();

  // Tab definitions
  const tabs = [
    { id: 'all', content: 'All', badge: totalCount.toString() },
    { id: 'active', content: 'Active', accessibilityLabel: 'Active credit notes' },
    { id: 'expired', content: 'Expired', accessibilityLabel: 'Expired credit notes' },
    { id: 'used', content: 'Used', accessibilityLabel: 'Fully used credit notes' },
  ];

  // Handle tab change
  const handleTabChange = useCallback((selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
    const tabId = tabs[selectedTabIndex].id;
    
    const searchParams = new URLSearchParams();
    if (tabId !== 'all') {
      searchParams.set('status', getStatusForTab(tabId));
    }
    
    navigate(`?${searchParams.toString()}`);
  }, [navigate]);

  // Handle filters
  const handleFiltersChange = useCallback(() => {
    const searchParams = new URLSearchParams();
    
    if (searchQuery) searchParams.set('search', searchQuery);
    if (statusFilter.length > 0) searchParams.set('status', statusFilter.join(','));
    if (sortValue !== 'created_desc') searchParams.set('sort', sortValue);
    
    navigate(`?${searchParams.toString()}`);
  }, [searchQuery, statusFilter, sortValue, navigate]);

  // Clear filters
  const handleFiltersClearAll = useCallback(() => {
    setSearchQuery('');
    setStatusFilter([]);
    setAmountRange([0, 10000]);
    setSortValue('created_desc');
    navigate('?');
  }, [navigate]);

  // Bulk actions
  const bulkActions = [
    {
      content: 'Cancel selected',
      onAction: () => handleBulkAction('cancel'),
    },
    {
      content: 'Export selected',
      onAction: () => handleBulkAction('export'),
    },
  ];

  const handleBulkAction = (action: string) => {
    // Implementation for bulk actions
    console.log(`Bulk action: ${action}`, selectedResources);
  };

  // Format currency
  const formatAmount = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge status="success">Active</Badge>;
      case 'PARTIALLY_USED':
        return <Badge status="attention">Partially Used</Badge>;
      case 'FULLY_USED':
        return <Badge status="info">Fully Used</Badge>;
      case 'EXPIRED':
        return <Badge status="critical">Expired</Badge>;
      case 'CANCELLED':
        return <Badge status="critical">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Table rows
  const rowMarkup = creditNotes.map((creditNote, index) => (
    <IndexTable.Row
      id={creditNote.id}
      key={creditNote.id}
      selected={selectedResources.includes(creditNote.id)}
      position={index}
    >
      <IndexTable.Cell>
        <Text fontWeight="bold" as="span">
          {creditNote.noteNumber}
        </Text>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        {creditNote.customerName && (
          <BlockStack gap="100">
            <Text as="span">{creditNote.customerName}</Text>
            {creditNote.customerEmail && (
              <Text variant="bodySm" tone="subdued" as="span">
                {creditNote.customerEmail}
              </Text>
            )}
          </BlockStack>
        )}
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text as="span">{formatAmount(creditNote.remainingAmount, creditNote.currency)}</Text>
          {creditNote.originalAmount !== creditNote.remainingAmount && (
            <Text variant="bodySm" tone="subdued" as="span">
              of {formatAmount(creditNote.originalAmount, creditNote.currency)}
            </Text>
          )}
        </BlockStack>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        {getStatusBadge(creditNote.status)}
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text as="span">
          {new Date(creditNote.createdAt).toLocaleDateString()}
        </Text>
        {creditNote.expiresAt && (
          <Text variant="bodySm" tone="subdued" as="span">
            Expires: {new Date(creditNote.expiresAt).toLocaleDateString()}
          </Text>
        )}
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        {creditNote.reason && (
          <Text variant="bodySm" as="span">
            {creditNote.reason.length > 30 
              ? `${creditNote.reason.substring(0, 30)}...`
              : creditNote.reason
            }
          </Text>
        )}
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <ButtonGroup>
          <Button
            size="slim"
            onClick={() => navigate(`/app/credit-notes/${creditNote.id}`)}
          >
            View
          </Button>
          
          <Button
            size="slim"
            variant="secondary"
            onClick={() => navigate(`/app/credit-notes/${creditNote.id}/edit`)}
          >
            Edit
          </Button>
        </ButtonGroup>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  // Empty state
  const emptyStateMarkup = (
    <EmptyState
      heading="Create your first credit note"
      action={{
        content: 'Create credit note',
        onAction: () => navigate('/app/credit-notes/new')
      }}
      secondaryAction={{
        content: 'Learn more',
        url: '#'
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Credit notes allow you to offer store credit to customers for returns, refunds, or promotions.</p>
    </EmptyState>
  );

  return (
    <Page
      title="Credit Notes"
      primaryAction={{
        content: 'Create credit note',
        onAction: () => navigate('/app/credit-notes/new')
      }}
      secondaryActions={[
        {
          content: 'Export',
          onAction: () => console.log('Export clicked')
        },
        {
          content: 'Import',
          onAction: () => console.log('Import clicked')
        }
      ]}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
              <Card.Section>
                <IndexFilters
                  sortOptions={[
                    { label: 'Newest first', value: 'created_desc' },
                    { label: 'Oldest first', value: 'created_asc' },
                    { label: 'Highest amount', value: 'amount_desc' },
                    { label: 'Lowest amount', value: 'amount_asc' },
                    { label: 'Status', value: 'status' },
                  ]}
                  sortSelected={[sortValue]}
                  queryValue={searchQuery}
                  queryPlaceholder="Search credit notes..."
                  onQueryChange={setSearchQuery}
                  onQueryClear={() => setSearchQuery('')}
                  onSort={(selected) => setSortValue(selected[0])}
                  onClearAll={handleFiltersClearAll}
                  filters={[]}
                  appliedFilters={[]}
                  onFiltersChange={() => {}}
                  canCreateNewView={false}
                  tabs={tabs}
                  selected={selectedTab}
                  onSelect={handleTabChange}
                  mode={mode}
                  setMode={setMode}
                />

                <IndexTable
                  resourceName={resourceName}
                  itemCount={creditNotes.length}
                  selectedItemsCount={
                    allResourcesSelected ? 'All' : selectedResources.length
                  }
                  onSelectionChange={handleSelectionChange}
                  bulkActions={bulkActions}
                  headings={[
                    { title: 'Credit Note' },
                    { title: 'Customer' },
                    { title: 'Amount' },
                    { title: 'Status' },
                    { title: 'Created' },
                    { title: 'Reason' },
                    { title: 'Actions' },
                  ]}
                  emptyState={emptyStateMarkup}
                >
                  {rowMarkup}
                </IndexTable>
              </Card.Section>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// Helper function to get status filter for tabs
function getStatusForTab(tabId: string): string {
  switch (tabId) {
    case 'active':
      return 'ACTIVE,PARTIALLY_USED';
    case 'expired':
      return 'EXPIRED';
    case 'used':
      return 'FULLY_USED';
    default:
      return '';
  }
}