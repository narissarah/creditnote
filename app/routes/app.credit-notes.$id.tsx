// Credit note detail view
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useNavigate, useSubmit, useSearchParams } from '@remix-run/react';
import {
  Card,
  Page,
  Layout,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  ButtonGroup,
  Divider,
  Banner,
  IndexTable,
  Thumbnail,
  TextField,
  FormLayout,
  Select,
  Tooltip,
  Icon,
  Box
} from '@shopify/polaris';
import { 
  EditIcon, 
  ExternalIcon, 
  PrintIcon, 
  DuplicateIcon,
  DeleteIcon 
} from '@shopify/polaris-icons';
import { useState, useCallback } from 'react';
import { authenticate } from '../shopify.server';
import { CreditNoteService } from '../services/creditNote.server';
import { formatDate, formatDateTime } from '../utils/date';

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
  qrCode: string;
  qrCodeImage: string;
  originalOrderId?: string;
  originalOrderNumber?: string;
  issuedBy?: string;
  issuedByName?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  transactions: Array<{
    id: string;
    amount: number;
    type: string;
    description?: string;
    orderId?: string;
    orderNumber?: string;
    staffName?: string;
    createdAt: string;
  }>;
}

interface LoaderData {
  creditNote: CreditNote;
  customer?: {
    id: string;
    displayName: string;
    email: string;
    totalSpent: string;
  };
  totalCreditBalance: number;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  if (!params.id) {
    throw new Response('Not Found', { status: 404 });
  }

  const creditService = new CreditNoteService(session.shop, admin);
  const creditNote = await creditService.findById(params.id);
  
  if (!creditNote) {
    throw new Response('Credit Note Not Found', { status: 404 });
  }

  // Get customer details
  let customer = null;
  if (creditNote.customerId) {
    try {
      const customerResponse = await admin.graphql(`
        query getCustomer($id: ID!) {
          customer(id: $id) {
            id
            displayName
            email
            totalSpent
          }
        }
      `, {
        variables: { id: creditNote.customerId }
      });

      const customerData = await customerResponse.json();
      customer = customerData.data?.customer;
    } catch (error) {
      console.warn('Failed to fetch customer:', error);
    }
  }

  // Get customer's total credit balance
  const totalCreditBalance = await creditService.getCustomerCreditBalance(creditNote.customerId);

  // Get transactions (this would be implemented in the service)
  const transactions = []; // await creditService.getTransactions(creditNote.id);

  return json({
    creditNote: {
      ...creditNote,
      transactions
    },
    customer,
    totalCreditBalance
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  if (!params.id) {
    throw new Response('Not Found', { status: 404 });
  }

  const formData = await request.formData();
  const action = formData.get('action') as string;
  
  const creditService = new CreditNoteService(session.shop, admin);
  
  try {
    switch (action) {
      case 'cancel':
        // Implementation for canceling credit note
        break;
      case 'extend_expiry':
        // Implementation for extending expiry
        break;
      case 'send_notification':
        // Implementation for sending notification
        break;
      default:
        throw new Error('Invalid action');
    }
    
    return json({ success: true });
    
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Action failed'
    }, { status: 500 });
  }
}

export default function CreditNoteDetail() {
  const { creditNote, customer, totalCreditBalance } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  
  // State
  const [showQRModal, setShowQRModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');

  // Show success banner if just created
  const showCreatedBanner = searchParams.get('created') === 'true';

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

  // Handle actions
  const handleAction = useCallback((action: string) => {
    const formData = new FormData();
    formData.append('action', action);
    submit(formData, { method: 'post' });
  }, [submit]);

  // Handle print credit note
  const handlePrintCreditNote = useCallback(() => {
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
              .transaction-history { margin: 20px 0; }
              .transaction-history table { width: 100%; border-collapse: collapse; }
              .transaction-history th, .transaction-history td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              .transaction-history th { background-color: #f2f2f2; }
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
              <p><strong>Customer:</strong> ${creditNote.customerName || customer?.displayName || 'N/A'}</p>
              <p><strong>Email:</strong> ${creditNote.customerEmail || customer?.email || 'N/A'}</p>
              <p><strong>Available Amount:</strong> ${formatAmount(creditNote.remainingAmount, creditNote.currency)}</p>
              <p><strong>Original Amount:</strong> ${formatAmount(creditNote.originalAmount, creditNote.currency)}</p>
              <p><strong>Status:</strong> ${creditNote.status}</p>
              <p><strong>Created:</strong> ${formatDate(creditNote.createdAt)}</p>
              ${creditNote.expiresAt ? `<p><strong>Expires:</strong> ${formatDate(creditNote.expiresAt)}</p>` : ''}
              ${creditNote.reason ? `<p><strong>Reason:</strong> ${creditNote.reason}</p>` : ''}
              ${creditNote.originalOrderNumber ? `<p><strong>Original Order:</strong> ${creditNote.originalOrderNumber}</p>` : ''}
              ${creditNote.issuedByName ? `<p><strong>Issued By:</strong> ${creditNote.issuedByName}</p>` : ''}
            </div>
            
            <div class="qr-section">
              <p><strong>Scan QR Code at POS:</strong></p>
              ${creditNote.qrCodeImage ? `<img src="${creditNote.qrCodeImage}" alt="QR Code" style="width: 200px; height: 200px;">` : '<p>QR Code not available</p>'}
            </div>
            
            ${creditNote.transactions.length > 0 ? `
              <div class="transaction-history">
                <h3>Transaction History</h3>
                <table>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Description</th>
                  </tr>
                  ${creditNote.transactions.map(transaction => `
                    <tr>
                      <td>${formatDateTime(transaction.createdAt)}</td>
                      <td>${transaction.type.replace('_', ' ')}</td>
                      <td>${formatAmount(transaction.amount, creditNote.currency)}</td>
                      <td>${transaction.description || '—'}</td>
                    </tr>
                  `).join('')}
                </table>
              </div>
            ` : ''}
            
            <div class="footer">
              <p>This credit note can be redeemed at any store location. Present this receipt or scan the QR code at checkout.</p>
              <p>Generated on: ${new Date().toLocaleString()}</p>
              <p>Store: ${creditNote.shop || 'N/A'}</p>
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
  }, [creditNote, customer]);

  // Handle redeem submission
  const handleRedeemSubmit = useCallback(() => {
    if (!redeemAmount) return;

    const amount = parseFloat(redeemAmount);
    if (isNaN(amount) || amount <= 0 || amount > creditNote.remainingAmount) {
      // Show error - invalid amount
      return;
    }

    const formData = new FormData();
    formData.append('action', 'redeem');
    formData.append('creditNoteId', creditNote.id);
    formData.append('amount', amount.toString());
    formData.append('description', `Admin redemption - ${amount}`);

    submit(formData, { 
      method: 'post',
      action: '/api/credit-notes/redeem'
    });

    setShowRedeemModal(false);
    setRedeemAmount('');
  }, [creditNote, redeemAmount, submit]);

  // Transaction rows
  const transactionRows = creditNote.transactions.map((transaction, index) => (
    <IndexTable.Row id={transaction.id} key={transaction.id} position={index}>
      <IndexTable.Cell>
        <Text as="span">{formatDateTime(transaction.createdAt)}</Text>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Badge status={transaction.type.includes('REDEMPTION') ? 'info' : 'success'}>
          {transaction.type.replace('_', ' ')}
        </Badge>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text as="span">{formatAmount(transaction.amount, creditNote.currency)}</Text>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text as="span">{transaction.description || '—'}</Text>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        {transaction.orderNumber ? (
          <Button
            variant="plain"
            onClick={() => navigate(`/app/orders/${transaction.orderId}`)}
          >
            {transaction.orderNumber}
          </Button>
        ) : (
          <Text as="span">—</Text>
        )}
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text as="span">{transaction.staffName || '—'}</Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title={`Credit Note ${creditNote.noteNumber}`}
      breadcrumbs={[{ content: 'Credit Notes', url: '/app/credit-notes' }]}
      primaryAction={{
        content: 'Edit',
        icon: EditIcon,
        onAction: () => navigate(`/app/credit-notes/${creditNote.id}/edit`)
      }}
      secondaryActions={[
        {
          content: 'Print Credit Note',
          icon: PrintIcon,
          onAction: () => handlePrintCreditNote()
        },
        {
          content: 'Redeem Credit',
          onAction: () => setShowRedeemModal(true),
          disabled: creditNote.status !== 'active' && creditNote.status !== 'partially_used'
        },
        {
          content: 'View QR Code',
          onAction: () => setShowQRModal(true)
        },
        {
          content: 'Send to Customer',
          onAction: () => handleAction('send_notification')
        },
        {
          content: 'More actions',
          menuActions: [
            { content: 'Duplicate', onAction: () => navigate(`/app/credit-notes/new?duplicate=${creditNote.id}`) },
            { content: 'Extend Expiry', onAction: () => setShowExtendModal(true) },
            { content: 'Cancel Credit', destructive: true, onAction: () => setShowCancelModal(true) }
          ]
        }
      ]}
    >
      <Layout>
        {showCreatedBanner && (
          <Layout.Section>
            <Banner
              status="success"
              title="Credit note created successfully"
              onDismiss={() => navigate(`/app/credit-notes/${creditNote.id}`, { replace: true })}
            >
              <p>The credit note has been created and is ready to use. You can now send it to the customer or use it at POS.</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <BlockStack gap="500">
            {/* Credit Note Overview */}
            <Card>
              <BlockStack gap="400">
                <InlineStack alignment="space-between">
                  <Text variant="headingLg" as="h1">
                    {creditNote.noteNumber}
                  </Text>
                  {getStatusBadge(creditNote.status)}
                </InlineStack>

                <BlockStack gap="300">
                  <InlineStack gap="800">
                    <Box minWidth="200px">
                      <BlockStack gap="200">
                        <Text variant="headingSm" tone="subdued">Available Amount</Text>
                        <Text variant="headingLg">
                          {formatAmount(creditNote.remainingAmount, creditNote.currency)}
                        </Text>
                        {creditNote.originalAmount !== creditNote.remainingAmount && (
                          <Text variant="bodySm" tone="subdued">
                            of {formatAmount(creditNote.originalAmount, creditNote.currency)} original
                          </Text>
                        )}
                      </BlockStack>
                    </Box>

                    <Box minWidth="200px">
                      <BlockStack gap="200">
                        <Text variant="headingSm" tone="subdued">Customer</Text>
                        <BlockStack gap="100">
                          {customer ? (
                            <>
                              <Button
                                variant="plain"
                                onClick={() => navigate(`/app/customers/${customer.id}`)}
                              >
                                {customer.displayName}
                              </Button>
                              <Text variant="bodySm" tone="subdued">
                                {customer.email}
                              </Text>
                            </>
                          ) : (
                            <Text>{creditNote.customerEmail || 'Unknown'}</Text>
                          )}
                          
                          {totalCreditBalance > 0 && (
                            <Text variant="bodySm" tone="success">
                              Total Credit Balance: {formatAmount(totalCreditBalance, creditNote.currency)}
                            </Text>
                          )}
                        </BlockStack>
                      </BlockStack>
                    </Box>

                    <Box minWidth="200px">
                      <BlockStack gap="200">
                        <Text variant="headingSm" tone="subdued">Details</Text>
                        <BlockStack gap="100">
                          <Text variant="bodySm">
                            Created: {formatDate(creditNote.createdAt)}
                          </Text>
                          
                          {creditNote.expiresAt && (
                            <Text variant="bodySm" tone={
                              new Date(creditNote.expiresAt) < new Date() ? 'critical' : 'subdued'
                            }>
                              Expires: {formatDate(creditNote.expiresAt)}
                            </Text>
                          )}
                          
                          {creditNote.reason && (
                            <Text variant="bodySm">
                              Reason: {creditNote.reason}
                            </Text>
                          )}

                          {creditNote.originalOrderNumber && (
                            <Button
                              variant="plain"
                              size="slim"
                              onClick={() => navigate(`/app/orders/${creditNote.originalOrderId}`)}
                            >
                              Original Order: {creditNote.originalOrderNumber}
                            </Button>
                          )}
                        </BlockStack>
                      </BlockStack>
                    </Box>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Transactions History */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Transaction History
                </Text>

                {creditNote.transactions.length > 0 ? (
                  <IndexTable
                    resourceName={{ singular: 'transaction', plural: 'transactions' }}
                    itemCount={creditNote.transactions.length}
                    headings={[
                      { title: 'Date & Time' },
                      { title: 'Type' },
                      { title: 'Amount' },
                      { title: 'Description' },
                      { title: 'Order' },
                      { title: 'Staff' },
                    ]}
                    selectable={false}
                  >
                    {transactionRows}
                  </IndexTable>
                ) : (
                  <Text tone="subdued">No transactions yet</Text>
                )}
              </BlockStack>
            </Card>

            {/* QR Code Section */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  QR Code
                </Text>

                <InlineStack gap="400" alignment="center">
                  <Thumbnail
                    source={creditNote.qrCodeImage}
                    alt={`QR Code for ${creditNote.noteNumber}`}
                    size="large"
                  />
                  
                  <BlockStack gap="200">
                    <Text>Scan this QR code at POS to apply the credit</Text>
                    <ButtonGroup>
                      <Button onClick={() => setShowQRModal(true)}>
                        View Full Size
                      </Button>
                      <Button 
                        onClick={() => {
                          // Download QR code
                          if (typeof window !== 'undefined') {
                            const link = document.createElement('a');
                            link.download = `${creditNote.noteNumber}-qr.png`;
                            link.href = creditNote.qrCodeImage;
                            link.click();
                          }
                        }}
                      >
                        Download
                      </Button>
                    </ButtonGroup>
                  </BlockStack>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* Redeem Credit Note - Custom Overlay (Frame-free) */}
      {showRedeemModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e1e5e9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="headingMd">Redeem Credit Note</Text>
                <Button
                  plain
                  onClick={() => setShowRedeemModal(false)}
                  ariaLabel="Close"
                >
                  ×
                </Button>
              </div>
            </div>
            <div style={{ padding: '20px' }}>
          <BlockStack gap="400">
            <Banner status="info">
              <p>You are about to redeem credit from {creditNote.noteNumber}</p>
            </Banner>

            <InlineStack gap="400">
              <Box minWidth="200px">
                <BlockStack gap="200">
                  <Text variant="headingSm">Credit Note Details</Text>
                  <Text>Number: {creditNote.noteNumber}</Text>
                  <Text>Customer: {creditNote.customerName || customer?.displayName || 'N/A'}</Text>
                  <Text>Available: {formatAmount(creditNote.remainingAmount, creditNote.currency)}</Text>
                </BlockStack>
              </Box>
            </InlineStack>

            <FormLayout>
              <TextField
                label="Redeem Amount"
                type="number"
                value={redeemAmount}
                onChange={(value) => setRedeemAmount(value)}
                prefix={creditNote.currency}
                min="0.01"
                max={creditNote.remainingAmount.toString()}
                step="0.01"
                helpText={`Maximum available: ${formatAmount(creditNote.remainingAmount, creditNote.currency)}`}
                error={
                  redeemAmount && 
                  (parseFloat(redeemAmount) > creditNote.remainingAmount || parseFloat(redeemAmount) <= 0)
                    ? 'Amount must be between 0.01 and available balance'
                    : undefined
                }
              />
            </FormLayout>

            <Banner status="warning">
              <p>This action will permanently reduce the available credit amount. This cannot be undone.</p>
            </Banner>
          </BlockStack>
            </div>
            <div style={{
              padding: '20px',
              borderTop: '1px solid #e1e5e9',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <Button onClick={() => setShowRedeemModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRedeemSubmit}
                disabled={!redeemAmount || parseFloat(redeemAmount) <= 0}
              >
                Redeem Credit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code - Custom Overlay (Frame-free) */}
      {showQRModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e1e5e9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="headingMd">QR Code - {creditNote.noteNumber}</Text>
                <Button
                  plain
                  onClick={() => setShowQRModal(false)}
                  ariaLabel="Close"
                >
                  ×
                </Button>
              </div>
            </div>
            <div style={{ padding: '20px' }}>
          <InlineStack alignment="center">
            <img
              src={creditNote.qrCodeImage}
              alt={`QR Code for ${creditNote.noteNumber}`}
              style={{ maxWidth: '300px', height: 'auto' }}
            />
          </InlineStack>
          
          <BlockStack gap="200">
            <Text alignment="center">
              Available Amount: {formatAmount(creditNote.remainingAmount, creditNote.currency)}
            </Text>
            
            <Text variant="bodySm" alignment="center" tone="subdued">
              Scan this code at POS to apply credit to a transaction
            </Text>
          </BlockStack>
            </div>
            <div style={{
              padding: '20px',
              borderTop: '1px solid #e1e5e9',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <Button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    const link = document.createElement('a');
                    link.download = `${creditNote.noteNumber}-qr.png`;
                    link.href = creditNote.qrCodeImage;
                    link.click();
                  }
                }}
              >
                Download
              </Button>
              <Button onClick={() => setShowQRModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Credit - Custom Overlay (Frame-free) */}
      {showCancelModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e1e5e9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="headingMd">Cancel Credit Note</Text>
                <Button
                  plain
                  onClick={() => setShowCancelModal(false)}
                  ariaLabel="Close"
                >
                  ×
                </Button>
              </div>
            </div>
            <div style={{ padding: '20px' }}>
          <BlockStack gap="300">
            <Text>
              Are you sure you want to cancel this credit note? This action cannot be undone.
            </Text>
            
            <Banner status="warning">
              <p>The customer will no longer be able to use this credit note after cancellation.</p>
            </Banner>
          </BlockStack>
            </div>
            <div style={{
              padding: '20px',
              borderTop: '1px solid #e1e5e9',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <Button onClick={() => setShowCancelModal(false)}>
                Keep Active
              </Button>
              <Button
                variant="primary"
                tone="critical"
                onClick={() => handleAction('cancel')}
              >
                Cancel Credit Note
              </Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}