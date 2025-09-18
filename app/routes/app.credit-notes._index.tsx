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
  Pagination,
  Modal,
  FormLayout,
  Banner
} from '@shopify/polaris';
import { useState, useCallback } from 'react';
import { authenticate } from '../shopify.server';
import { formatDate } from '../utils/date';
import db from '../db.server';

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
  const { session } = await authenticate.admin(request);

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";

    console.log('[Admin] Shop domain from session:', session.shop);

    // Use direct database access like POS API does
    const whereConditions: any = {
      shopDomain: session.shop,
    };

    if (search) {
      whereConditions.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { noteNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      switch (status) {
        case 'active':
          whereConditions.status = { in: ['active', 'partially_used'] };
          break;
        case 'expired':
          whereConditions.expiresAt = { lt: new Date() };
          break;
        case 'used':
          whereConditions.status = 'fully_used';
          break;
      }
    }

    // Get total count for pagination
    const totalCount = await db.creditNote.count({
      where: whereConditions,
    });

    // Get credit notes with pagination
    const creditNotes = await db.creditNote.findMany({
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        noteNumber: true,
        customerName: true,
        customerEmail: true,
        originalAmount: true,
        remainingAmount: true,
        currency: true,
        status: true,
        reason: true,
        createdAt: true,
        expiresAt: true,
        qrCode: true,
        customerId: true,
      },
    });

    const hasMore = offset + limit < totalCount;

    // Transform data to match interface
    const transformedNotes = creditNotes.map(note => ({
      ...note,
      noteNumber: note.noteNumber || note.id,
      qrCodeImage: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%23000'/><text x='100' y='100' fill='white' text-anchor='middle'>${note.qrCode || note.noteNumber}</text></svg>`
    }));

    return json({
      creditNotes: transformedNotes,
      totalCount,
      hasMore,
      filters: { status, search }
    });

  } catch (error) {
    console.error('Error loading credit notes:', error);
    return json({
      creditNotes: [],
      totalCount: 0,
      hasMore: false,
      filters: {}
    });
  }
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
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNote | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('');

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
      content: 'Print selected',
      onAction: () => handleBulkAction('print'),
    },
    {
      content: 'Bulk redeem',
      onAction: () => handleBulkAction('bulk_redeem'),
    },
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
    const selectedCreditNotes = creditNotes.filter(cn => selectedResources.includes(cn.id));
    
    switch (action) {
      case 'print':
        // Print all selected credit notes
        selectedCreditNotes.forEach(creditNote => {
          setTimeout(() => handlePrintCreditNote(creditNote), 200); // Stagger printing
        });
        break;
        
      case 'bulk_redeem':
        // Open bulk redeem interface
        console.log('Opening bulk redeem for:', selectedCreditNotes);
        // TODO: Implement bulk redeem modal
        break;
        
      case 'cancel':
        // Cancel selected credit notes
        if (confirm(`Are you sure you want to cancel ${selectedResources.length} credit notes?`)) {
          const formData = new FormData();
          formData.append('action', 'bulk_cancel');
          formData.append('creditNoteIds', JSON.stringify(selectedResources));
          submit(formData, { method: 'post' });
        }
        break;
        
      case 'export':
        // Export selected credit notes
        const csvContent = generateCSVExport(selectedCreditNotes);
        downloadCSV(csvContent, `credit-notes-${new Date().toISOString().split('T')[0]}.csv`);
        break;
        
      default:
        console.log(`Bulk action: ${action}`, selectedResources);
    }
  };

  // Generate CSV export
  const generateCSVExport = (creditNotes: CreditNote[]) => {
    const headers = ['Note Number', 'Customer Name', 'Customer Email', 'Original Amount', 'Remaining Amount', 'Currency', 'Status', 'Created', 'Expires', 'Reason'];
    const rows = creditNotes.map(cn => [
      cn.noteNumber,
      cn.customerName || '',
      cn.customerEmail || '',
      cn.originalAmount,
      cn.remainingAmount,
      cn.currency,
      cn.status,
      formatDate(cn.createdAt),
      cn.expiresAt ? formatDate(cn.expiresAt) : '',
      cn.reason || ''
    ]);

    return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
  };

  // Download CSV file
  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  // Handle print credit note
  const handlePrintCreditNote = useCallback((creditNote: CreditNote) => {
    // Create a new window with printable credit note
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Credit Note ${creditNote.noteNumber}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
              .content { margin: 20px 0; }
              .qr-section { text-align: center; margin: 20px 0; }
              .footer { border-top: 1px solid #ccc; padding-top: 10px; font-size: 12px; color: #666; }
              @media print {
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>STORE CREDIT NOTE</h1>
              <h2>${creditNote.noteNumber}</h2>
            </div>
            
            <div class="content">
              <p><strong>Customer:</strong> ${creditNote.customerName || 'N/A'}</p>
              <p><strong>Email:</strong> ${creditNote.customerEmail || 'N/A'}</p>
              <p><strong>Available Amount:</strong> ${formatAmount(creditNote.remainingAmount, creditNote.currency)}</p>
              <p><strong>Original Amount:</strong> ${formatAmount(creditNote.originalAmount, creditNote.currency)}</p>
              <p><strong>Status:</strong> ${creditNote.status}</p>
              <p><strong>Created:</strong> ${formatDate(creditNote.createdAt)}</p>
              ${creditNote.expiresAt ? `<p><strong>Expires:</strong> ${formatDate(creditNote.expiresAt)}</p>` : ''}
              ${creditNote.reason ? `<p><strong>Reason:</strong> ${creditNote.reason}</p>` : ''}
            </div>
            
            <div class="qr-section">
              <p><strong>Scan QR Code at POS:</strong></p>
              ${creditNote.qrCodeImage ? `<img src="${creditNote.qrCodeImage}" alt="QR Code" style="width: 200px; height: 200px;">` : '<p>QR Code not available</p>'}
            </div>
            
            <div class="footer">
              <p>This credit note can be redeemed at any store location. Present this receipt or scan the QR code at checkout.</p>
              <p>Generated on: ${new Date().toLocaleString()}</p>
            </div>
            
            <div class="no-print" style="text-align: center; margin: 20px;">
              <button onclick="window.print()">Print</button>
              <button onclick="window.close()">Close</button>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      
      // Auto-print after a short delay
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }, []);

  // Handle redeem credit note
  const handleRedeemCreditNote = useCallback((creditNote: CreditNote) => {
    setSelectedCreditNote(creditNote);
    setRedeemAmount(creditNote.remainingAmount.toString());
    setShowRedeemModal(true);
  }, []);

  // Handle redeem submission
  const handleRedeemSubmit = useCallback(() => {
    if (!selectedCreditNote || !redeemAmount) return;

    const amount = parseFloat(redeemAmount);
    if (isNaN(amount) || amount <= 0 || amount > selectedCreditNote.remainingAmount) {
      // Show error - invalid amount
      return;
    }

    const formData = new FormData();
    formData.append('action', 'redeem');
    formData.append('creditNoteId', selectedCreditNote.id);
    formData.append('amount', amount.toString());
    formData.append('description', `Admin redemption - ${amount}`);

    submit(formData, { 
      method: 'post',
      action: '/api/credit-notes/redeem'
    });

    setShowRedeemModal(false);
    setSelectedCreditNote(null);
    setRedeemAmount('');
  }, [selectedCreditNote, redeemAmount, submit]);

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
      case 'active':
        return <Badge status="success">Active</Badge>;
      case 'partially_used':
        return <Badge status="attention">Partially Used</Badge>;
      case 'fully_used':
        return <Badge status="info">Fully Used</Badge>;
      case 'expired':
        return <Badge status="critical">Expired</Badge>;
      case 'cancelled':
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
          {formatDate(creditNote.createdAt)}
        </Text>
        {creditNote.expiresAt && (
          <Text variant="bodySm" tone="subdued" as="span">
            Expires: {formatDate(creditNote.expiresAt)}
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
            onClick={() => handlePrintCreditNote(creditNote)}
          >
            Print
          </Button>
          
          <Button
            size="slim"
            variant="primary"
            onClick={() => handleRedeemCreditNote(creditNote)}
            disabled={creditNote.status !== 'active' && creditNote.status !== 'partially_used'}
          >
            Redeem
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

      {/* Redeem Credit Note Modal */}
      <Modal
        open={showRedeemModal}
        onClose={() => setShowRedeemModal(false)}
        title="Redeem Credit Note"
        primaryAction={{
          content: 'Redeem Credit',
          onAction: handleRedeemSubmit,
          disabled: !redeemAmount || parseFloat(redeemAmount) <= 0
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowRedeemModal(false)
          }
        ]}
      >
        <Modal.Section>
          {selectedCreditNote && (
            <BlockStack gap="400">
              <Banner status="info">
                <p>You are about to redeem credit from {selectedCreditNote.noteNumber}</p>
              </Banner>

              <InlineStack gap="400">
                <Box minWidth="200px">
                  <BlockStack gap="200">
                    <Text variant="headingSm">Credit Note Details</Text>
                    <Text>Number: {selectedCreditNote.noteNumber}</Text>
                    <Text>Customer: {selectedCreditNote.customerName || 'N/A'}</Text>
                    <Text>Available: {formatAmount(selectedCreditNote.remainingAmount, selectedCreditNote.currency)}</Text>
                  </BlockStack>
                </Box>
              </InlineStack>

              <FormLayout>
                <TextField
                  label="Redeem Amount"
                  type="number"
                  value={redeemAmount}
                  onChange={(value) => setRedeemAmount(value)}
                  prefix={selectedCreditNote.currency}
                  min="0.01"
                  max={selectedCreditNote.remainingAmount.toString()}
                  step="0.01"
                  helpText={`Maximum available: ${formatAmount(selectedCreditNote.remainingAmount, selectedCreditNote.currency)}`}
                  error={
                    redeemAmount && 
                    (parseFloat(redeemAmount) > selectedCreditNote.remainingAmount || parseFloat(redeemAmount) <= 0)
                      ? 'Amount must be between 0.01 and available balance'
                      : undefined
                  }
                />
              </FormLayout>

              <Banner status="warning">
                <p>This action will permanently reduce the available credit amount. This cannot be undone.</p>
              </Banner>
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}

// Helper function to get status filter for tabs
function getStatusForTab(tabId: string): string {
  switch (tabId) {
    case 'active':
      return 'active,partially_used';
    case 'expired':
      return 'expired';
    case 'used':
      return 'fully_used';
    default:
      return '';
  }
}