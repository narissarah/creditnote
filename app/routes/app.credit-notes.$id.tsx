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
  Modal,
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
import { authenticate } from '~/shopify.server';
import { CreditNoteService } from '~/services/creditNote.server';

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

  // Handle actions
  const handleAction = useCallback((action: string) => {
    const formData = new FormData();
    formData.append('action', action);
    submit(formData, { method: 'post' });
  }, [submit]);

  // Transaction rows
  const transactionRows = creditNote.transactions.map((transaction, index) => (
    <IndexTable.Row id={transaction.id} key={transaction.id} position={index}>
      <IndexTable.Cell>
        <Text as="span">{new Date(transaction.createdAt).toLocaleString()}</Text>
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
          content: 'Print',
          icon: PrintIcon,
          onAction: () => window.print()
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
                            Created: {new Date(creditNote.createdAt).toLocaleDateString()}
                          </Text>
                          
                          {creditNote.expiresAt && (
                            <Text variant="bodySm" tone={
                              new Date(creditNote.expiresAt) < new Date() ? 'critical' : 'subdued'
                            }>
                              Expires: {new Date(creditNote.expiresAt).toLocaleDateString()}
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
                          const link = document.createElement('a');
                          link.download = `${creditNote.noteNumber}-qr.png`;
                          link.href = creditNote.qrCodeImage;
                          link.click();
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

      {/* QR Code Modal */}
      <Modal
        open={showQRModal}
        onClose={() => setShowQRModal(false)}
        title={`QR Code - ${creditNote.noteNumber}`}
        secondaryActions={[
          {
            content: 'Download',
            onAction: () => {
              const link = document.createElement('a');
              link.download = `${creditNote.noteNumber}-qr.png`;
              link.href = creditNote.qrCodeImage;
              link.click();
            }
          }
        ]}
      >
        <Modal.Section>
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
        </Modal.Section>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Credit Note"
        primaryAction={{
          content: 'Cancel Credit Note',
          destructive: true,
          onAction: () => handleAction('cancel')
        }}
        secondaryActions={[
          {
            content: 'Keep Active',
            onAction: () => setShowCancelModal(false)
          }
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text>
              Are you sure you want to cancel this credit note? This action cannot be undone.
            </Text>
            
            <Banner status="warning">
              <p>The customer will no longer be able to use this credit note after cancellation.</p>
            </Banner>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}