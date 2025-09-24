// NUCLEAR FIX: Simplified working admin route
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSubmit, Form } from '@remix-run/react';
import {
  Card,
  FormLayout,
  TextField,
  Button,
  Page,
  Layout,
  BlockStack,
  Text,
  Banner,
  IndexTable,
  Badge
} from '@shopify/polaris';
import { useState } from 'react';
import { authenticate } from '../shopify.server';
import prisma from '../db.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

    const credits = await prisma.creditNote.findMany({
      where: {
        OR: [
          { shop: session.shop },
          { shopDomain: session.shop }
        ],
        deletedAt: null
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return json({
      credits: credits.map(c => ({
        id: c.id,
        customerName: c.customerName || 'Unknown',
        amount: c.originalAmount.toString(),
        status: c.status,
        createdAt: c.createdAt.toISOString()
      })),
      shop: session.shop
    });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);

    const formData = await request.formData();
    const customerName = formData.get('customerName') as string;
    const amount = parseFloat(formData.get('amount') as string);

    if (!customerName || !amount) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    const credit = await prisma.creditNote.create({
      data: {
        id: `CN-${Date.now()}`,
        customerId: `customer-${Date.now()}`,
        customerName,
        originalAmount: amount,
        remainingAmount: amount,
        currency: 'CAD',
        shopDomain: session.shop,
        shop: session.shop,  // Set both fields for compatibility
        status: 'active',
        qrCode: `CN-${Date.now()}`
      }
    });

    return redirect('/app/credits?success=true');
}

export default function Credits() {
  const { credits, shop } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append('customerName', customerName);
    formData.append('amount', amount);
    submit(formData, { method: 'post' });
  };

  const resourceName = { singular: 'credit', plural: 'credits' };

  const rowMarkup = credits.map((credit, index) => (
    <IndexTable.Row
      id={credit.id}
      key={credit.id}
      position={index}
    >
      <IndexTable.Cell>
        <Text fontWeight="bold">{credit.id}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text>{credit.customerName}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text>${credit.amount}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge status="success">{credit.status}</Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Credit Notes - Working Route">
      <Layout>
        <Layout.Section>
          <Banner status="success">
            <p>✅ This route works! Shop: {shop} | Credits: {credits.length}</p>
          </Banner>

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Create New Credit</Text>
              <FormLayout>
                <TextField
                  label="Customer Name"
                  value={customerName}
                  onChange={setCustomerName}
                  autoComplete="off"
                />
                <TextField
                  label="Amount"
                  type="number"
                  value={amount}
                  onChange={setAmount}
                  prefix="$"
                  autoComplete="off"
                />
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={!customerName || !amount}
                >
                  Create Credit Note
                </Button>
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <IndexTable
              resourceName={resourceName}
              itemCount={credits.length}
              headings={[
                { title: 'ID' },
                { title: 'Customer' },
                { title: 'Amount' },
                { title: 'Status' },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}