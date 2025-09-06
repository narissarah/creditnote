// Create new credit note form
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useActionData, useLoaderData, useNavigate, useSubmit, Form } from '@remix-run/react';
import {
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  Page,
  Layout,
  BlockStack,
  InlineStack,
  Text,
  Divider,
  Banner,
  Thumbnail,
  ButtonGroup,
  Modal,
  DatePicker,
  Popover,
  Icon,
  ResourcePicker
} from '@shopify/polaris';
import { useState, useCallback } from 'react';
import { CalendarIcon } from '@shopify/polaris-icons';
import { authenticate } from '../shopify.server';
import { CreditNoteService } from '../services/creditNote.server';
import { z } from 'zod';
import { formatDate } from '../utils/date';

const CreateCreditNoteSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('USD'),
  reason: z.string().optional(),
  expiresAt: z.string().optional(),
  originalOrderId: z.string().optional(),
  sendNotification: z.boolean().default(false),
});

interface LoaderData {
  currencies: Array<{ label: string; value: string }>;
  defaultCurrency: string;
  recentOrders: Array<{
    id: string;
    name: string;
    totalPrice: string;
    createdAt: string;
    customer?: {
      id: string;
      displayName: string;
      email: string;
    };
  }>;
}

interface ActionData {
  success?: boolean;
  creditNote?: any;
  errors?: Record<string, string>;
  message?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  // Get recent orders for quick selection
  const ordersResponse = await admin.graphql(`
    query getRecentOrders($first: Int!) {
      orders(first: $first, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            createdAt
            customer {
              id
              displayName
              email
            }
          }
        }
      }
    }
  `, {
    variables: { first: 10 }
  });

  const ordersData = await ordersResponse.json();
  const recentOrders = ordersData.data?.orders?.edges?.map((edge: any) => ({
    id: edge.node.id,
    name: edge.node.name,
    totalPrice: edge.node.totalPriceSet.shopMoney.amount,
    createdAt: edge.node.createdAt,
    customer: edge.node.customer
  })) || [];

  return json({
    currencies: [
      { label: 'USD - US Dollar', value: 'USD' },
      { label: 'CAD - Canadian Dollar', value: 'CAD' },
      { label: 'EUR - Euro', value: 'EUR' },
      { label: 'GBP - British Pound', value: 'GBP' },
    ],
    defaultCurrency: 'USD',
    recentOrders
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  try {
    const formData = await request.formData();
    const data = {
      customerId: formData.get('customerId') as string,
      amount: parseFloat(formData.get('amount') as string),
      currency: formData.get('currency') as string,
      reason: formData.get('reason') as string,
      expiresAt: formData.get('expiresAt') as string,
      originalOrderId: formData.get('originalOrderId') as string,
      sendNotification: formData.get('sendNotification') === 'true',
    };

    const validated = CreateCreditNoteSchema.parse(data);
    
    const creditService = new CreditNoteService(session.shop, admin);
    const creditNote = await creditService.createCreditNote(validated);

    // Send notification email if requested
    if (validated.sendNotification) {
      // Implementation for sending notification email
      console.log('Sending notification email for credit note:', creditNote.noteNumber);
    }

    return redirect(`/app/credit-notes/${creditNote.id}?created=true`);

  } catch (error) {
    console.error('Error creating credit note:', error);
    
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach(err => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      
      return json({
        success: false,
        errors,
        message: 'Please fix the errors below'
      }, { status: 400 });
    }

    return json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create credit note'
    }, { status: 500 });
  }
}

export default function NewCreditNote() {
  const { currencies, defaultCurrency, recentOrders } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigate = useNavigate();
  const submit = useSubmit();

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [customerDisplay, setCustomerDisplay] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [originalOrderId, setOriginalOrderId] = useState('');
  const [sendNotification, setSendNotification] = useState(false);

  // UI state
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Handle form submission
  const handleSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append('customerId', customerId);
    formData.append('amount', amount);
    formData.append('currency', currency);
    formData.append('reason', reason);
    formData.append('expiresAt', expiresAt);
    formData.append('originalOrderId', originalOrderId);
    formData.append('sendNotification', sendNotification.toString());

    submit(formData, { method: 'post' });
  }, [customerId, amount, currency, reason, expiresAt, originalOrderId, sendNotification, submit]);

  // Handle customer selection
  const handleCustomerSelect = useCallback((resources: any[]) => {
    if (resources.length > 0) {
      const customer = resources[0];
      setCustomerId(customer.id);
      setCustomerDisplay(customer.displayName || customer.email);
    }
    setCustomerPickerOpen(false);
  }, []);

  // Handle order selection
  const handleOrderSelect = useCallback((orderId: string) => {
    const order = recentOrders.find(o => o.id === orderId);
    if (order) {
      setOriginalOrderId(orderId);
      if (order.customer) {
        setCustomerId(order.customer.id);
        setCustomerDisplay(order.customer.displayName);
      }
      if (!amount) {
        setAmount(order.totalPrice);
      }
    }
    setOrderPickerOpen(false);
  }, [recentOrders, amount]);

  // Handle date picker
  const handleDateSelect = useCallback(({ start }: any) => {
    setSelectedDate(start);
    setExpiresAt(start.toISOString());
    setDatePickerOpen(false);
  }, []);

  // Common reason options
  const reasonOptions = [
    { label: 'Product return', value: 'Product return' },
    { label: 'Order cancellation', value: 'Order cancellation' },
    { label: 'Defective product', value: 'Defective product' },
    { label: 'Customer satisfaction', value: 'Customer satisfaction' },
    { label: 'Promotional credit', value: 'Promotional credit' },
    { label: 'Other', value: 'Other' },
  ];

  return (
    <Page
      title="Create Credit Note"
      breadcrumbs={[{ content: 'Credit Notes', url: '/app/credit-notes' }]}
      primaryAction={{
        content: 'Save Credit Note',
        onAction: handleSubmit,
        loading: false, // Add loading state if needed
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: () => navigate('/app/credit-notes'),
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          {actionData?.errors && (
            <Banner status="critical" title="Please fix the errors below">
              <ul>
                {Object.entries(actionData.errors).map(([field, error]) => (
                  <li key={field}>{error}</li>
                ))}
              </ul>
            </Banner>
          )}

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Credit Note Details
              </Text>

              <FormLayout>
                <FormLayout.Group>
                  <div>
                    <TextField
                      label="Customer"
                      value={customerDisplay}
                      onChange={() => {}} // Read only
                      placeholder="Select a customer"
                      connectedRight={
                        <Button onClick={() => setCustomerPickerOpen(true)}>
                          Browse
                        </Button>
                      }
                      error={actionData?.errors?.customerId}
                      requiredIndicator
                    />
                  </div>

                  <TextField
                    label="Amount"
                    type="number"
                    value={amount}
                    onChange={setAmount}
                    placeholder="0.00"
                    prefix={currency}
                    step="0.01"
                    min="0"
                    error={actionData?.errors?.amount}
                    requiredIndicator
                  />
                </FormLayout.Group>

                <FormLayout.Group>
                  <Select
                    label="Currency"
                    options={currencies}
                    value={currency}
                    onChange={setCurrency}
                  />

                  <div>
                    <TextField
                      label="Expiration Date"
                      value={expiresAt ? formatDate(expiresAt) : ''}
                      onChange={() => {}} // Read only
                      placeholder="No expiration"
                      connectedRight={
                        <Popover
                          active={datePickerOpen}
                          activator={
                            <Button
                              onClick={() => setDatePickerOpen(!datePickerOpen)}
                              icon={CalendarIcon}
                            />
                          }
                          onClose={() => setDatePickerOpen(false)}
                        >
                          <Card>
                            <DatePicker
                              month={selectedDate.getMonth()}
                              year={selectedDate.getFullYear()}
                              selected={selectedDate}
                              onMonthChange={(month, year) => {
                                setSelectedDate(new Date(year, month, selectedDate.getDate()));
                              }}
                              onChange={handleDateSelect}
                            />
                          </Card>
                        </Popover>
                      }
                    />
                  </div>
                </FormLayout.Group>

                <Select
                  label="Reason"
                  options={[
                    { label: 'Select a reason', value: '' },
                    ...reasonOptions
                  ]}
                  value={reason}
                  onChange={setReason}
                  helpText="Why is this credit being issued?"
                />

                {reason === 'Other' && (
                  <TextField
                    label="Custom Reason"
                    value=""
                    onChange={() => {}} // Handle custom reason
                    placeholder="Enter custom reason..."
                  />
                )}
              </FormLayout>

              <Divider />

              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">
                  Quick Actions
                </Text>

                <InlineStack gap="300">
                  <Button
                    variant="secondary"
                    onClick={() => setOrderPickerOpen(true)}
                  >
                    Select from Recent Order
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => setSendNotification(!sendNotification)}
                  >
                    {sendNotification ? '✓ ' : ''}Notify Customer
                  </Button>
                </InlineStack>

                {recentOrders.length > 0 && (
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h4">
                      Recent Orders
                    </Text>
                    
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {recentOrders.slice(0, 5).map((order) => (
                        <Card key={order.id} padding="200">
                          <InlineStack alignment="space-between">
                            <BlockStack gap="100">
                              <Text fontWeight="bold">{order.name}</Text>
                              <Text variant="bodySm" tone="subdued">
                                {order.customer?.displayName} - ${order.totalPrice}
                              </Text>
                            </BlockStack>
                            
                            <Button
                              size="slim"
                              onClick={() => handleOrderSelect(order.id)}
                            >
                              Use Order
                            </Button>
                          </InlineStack>
                        </Card>
                      ))}
                    </div>
                  </BlockStack>
                )}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Preview
              </Text>

              <BlockStack gap="200">
                <InlineStack alignment="space-between">
                  <Text>Amount:</Text>
                  <Text fontWeight="bold">
                    {amount ? `${currency} ${amount}` : '—'}
                  </Text>
                </InlineStack>

                <InlineStack alignment="space-between">
                  <Text>Customer:</Text>
                  <Text>{customerDisplay || '—'}</Text>
                </InlineStack>

                <InlineStack alignment="space-between">
                  <Text>Reason:</Text>
                  <Text>{reason || '—'}</Text>
                </InlineStack>

                <InlineStack alignment="space-between">
                  <Text>Expires:</Text>
                  <Text>
                    {expiresAt 
                      ? formatDate(expiresAt)
                      : 'Never'
                    }
                  </Text>
                </InlineStack>
              </BlockStack>

              <Divider />

              <BlockStack gap="200">
                <Text variant="headingSm">Next Steps</Text>
                <Text variant="bodySm" tone="subdued">
                  After creation, the credit note will be available for use in POS and can be sent to the customer via email.
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Customer Picker Modal */}
      <Modal
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        title="Select Customer"
        primaryAction={{
          content: 'Cancel',
          onAction: () => setCustomerPickerOpen(false),
        }}
      >
        <Modal.Section>
          <Text>Customer selection would be implemented here using Shopify's ResourcePicker</Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}