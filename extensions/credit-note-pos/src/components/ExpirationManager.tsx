// Credit Note Expiration Management and Notification System
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
  Banner,
  TextField
} from '@shopify/ui-extensions-react/point-of-sale';

import { CreditNote } from '../types/credit.types';
import { useCreditOperations } from '../hooks/useCreditOperations';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { formatCreditAmount, formatCreditNoteNumber } from '../utils/qrcode.utils';
import { isNearExpiration } from '../utils/validation.utils';

interface ExpirationAlert {
  id: string;
  creditNoteId: string;
  creditNote: CreditNote;
  alertType: 'EXPIRING_SOON' | 'EXPIRED' | 'EXTENSION_AVAILABLE';
  daysUntilExpiration: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: string;
  acknowledged: boolean;
  actionTaken?: string;
}

interface ExpirationRule {
  id: string;
  name: string;
  warningDays: number[];
  isActive: boolean;
  actions: {
    sendNotification: boolean;
    emailCustomer: boolean;
    offerExtension: boolean;
    autoExtend: boolean;
    extensionDays: number;
  };
}

interface ExpirationManagerProps {
  onExpirationAlert?: (alert: ExpirationAlert) => void;
  onCreditUpdated?: (credit: CreditNote) => void;
}

const ExpirationManager: React.FC<ExpirationManagerProps> = ({
  onExpirationAlert,
  onCreditUpdated
}) => {
  const api = useApi<'pos.home.modal.render'>();
  
  // State
  const [expiringCredits, setExpiringCredits] = useState<CreditNote[]>([]);
  const [expiredCredits, setExpiredCredits] = useState<CreditNote[]>([]);
  const [alerts, setAlerts] = useState<ExpirationAlert[]>([]);
  const [expirationRules, setExpirationRules] = useState<ExpirationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'expiring' | 'expired' | 'alerts' | 'rules'>('expiring');
  
  // Extension settings
  const [extensionDays, setExtensionDays] = useState(30);
  const [extensionReason, setExtensionReason] = useState('');
  const [selectedCredit, setSelectedCredit] = useState<CreditNote | null>(null);

  // Hooks
  const { fetchCredits, updateCredit } = useCreditOperations();
  const { isOnline, addToQueue } = useOfflineSync();

  // Default expiration rules
  const defaultRules: ExpirationRule[] = [
    {
      id: 'rule_30_days',
      name: '30-Day Warning',
      warningDays: [30, 14, 7, 3, 1],
      isActive: true,
      actions: {
        sendNotification: true,
        emailCustomer: true,
        offerExtension: false,
        autoExtend: false,
        extensionDays: 30
      }
    },
    {
      id: 'rule_high_value',
      name: 'High-Value Credits',
      warningDays: [60, 30, 14, 7],
      isActive: true,
      actions: {
        sendNotification: true,
        emailCustomer: true,
        offerExtension: true,
        autoExtend: false,
        extensionDays: 90
      }
    }
  ];

  // Load expiring credits and alerts on mount
  useEffect(() => {
    loadExpirationData();
    loadExpirationRules();
  }, []);

  // Check for new expiration alerts periodically
  useEffect(() => {
    const interval = setInterval(() => {
      checkExpirationAlerts();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [expiringCredits, expirationRules]);

  /**
   * Load credits nearing expiration
   */
  const loadExpirationData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all active credits
      const response = await fetchCredits();
      if (response.success && response.credits) {
        const now = new Date();
        const expiring: CreditNote[] = [];
        const expired: CreditNote[] = [];

        response.credits.forEach(credit => {
          if (!credit.expiresAt) return;

          const expiryDate = new Date(credit.expiresAt);
          if (expiryDate < now) {
            expired.push(credit);
          } else if (isNearExpiration(credit.expiresAt, 60)) { // 60 days threshold
            expiring.push(credit);
          }
        });

        // Sort by expiration date
        expiring.sort((a, b) => 
          new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime()
        );
        
        expired.sort((a, b) => 
          new Date(b.expiresAt!).getTime() - new Date(a.expiresAt!).getTime()
        );

        setExpiringCredits(expiring);
        setExpiredCredits(expired);
      }
    } catch (error) {
      api.toast.show('Failed to load expiration data', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchCredits, api.toast]);

  /**
   * Load expiration rules
   */
  const loadExpirationRules = useCallback(() => {
    const stored = localStorage.getItem('creditcraft_expiration_rules');
    if (stored) {
      setExpirationRules(JSON.parse(stored));
    } else {
      setExpirationRules(defaultRules);
      localStorage.setItem('creditcraft_expiration_rules', JSON.stringify(defaultRules));
    }
  }, []);

  /**
   * Check for new expiration alerts
   */
  const checkExpirationAlerts = useCallback(() => {
    const newAlerts: ExpirationAlert[] = [];
    const now = new Date();

    expiringCredits.forEach(credit => {
      if (!credit.expiresAt) return;

      const expiryDate = new Date(credit.expiresAt);
      const daysUntilExpiration = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check against active rules
      expirationRules
        .filter(rule => rule.isActive)
        .forEach(rule => {
          if (rule.warningDays.includes(daysUntilExpiration)) {
            // Check if alert already exists
            const existingAlert = alerts.find(
              alert => 
                alert.creditNoteId === credit.id && 
                alert.daysUntilExpiration === daysUntilExpiration
            );

            if (!existingAlert) {
              const priority = daysUntilExpiration <= 3 ? 'HIGH' : 
                               daysUntilExpiration <= 7 ? 'MEDIUM' : 'LOW';

              const alert: ExpirationAlert = {
                id: `alert_${Date.now()}_${credit.id}`,
                creditNoteId: credit.id,
                creditNote: credit,
                alertType: 'EXPIRING_SOON',
                daysUntilExpiration,
                priority,
                createdAt: new Date().toISOString(),
                acknowledged: false
              };

              newAlerts.push(alert);
            }
          }
        });
    });

    // Add expired credit alerts
    expiredCredits.forEach(credit => {
      const existingAlert = alerts.find(
        alert => alert.creditNoteId === credit.id && alert.alertType === 'EXPIRED'
      );

      if (!existingAlert) {
        const alert: ExpirationAlert = {
          id: `alert_expired_${Date.now()}_${credit.id}`,
          creditNoteId: credit.id,
          creditNote: credit,
          alertType: 'EXPIRED',
          daysUntilExpiration: -Math.ceil(
            (Date.now() - new Date(credit.expiresAt!).getTime()) / (1000 * 60 * 60 * 24)
          ),
          priority: 'HIGH',
          createdAt: new Date().toISOString(),
          acknowledged: false
        };

        newAlerts.push(alert);
      }
    });

    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev]);
      
      // Notify parent component
      newAlerts.forEach(alert => {
        if (onExpirationAlert) {
          onExpirationAlert(alert);
        }
      });

      // Show toast for high priority alerts
      const highPriorityAlerts = newAlerts.filter(a => a.priority === 'HIGH');
      if (highPriorityAlerts.length > 0) {
        api.toast.show(
          `${highPriorityAlerts.length} high-priority expiration alerts`,
          'critical'
        );
      }
    }
  }, [expiringCredits, expiredCredits, expirationRules, alerts, onExpirationAlert, api.toast]);

  /**
   * Extend credit note expiration
   */
  const extendCreditExpiration = useCallback(async (
    credit: CreditNote,
    additionalDays: number,
    reason: string
  ) => {
    try {
      setLoading(true);

      const currentExpiry = credit.expiresAt ? new Date(credit.expiresAt) : new Date();
      const newExpiry = new Date(currentExpiry.getTime() + (additionalDays * 24 * 60 * 60 * 1000));

      const updateData = {
        expiresAt: newExpiry.toISOString(),
        extendedAt: new Date().toISOString(),
        extensionReason: reason,
        extensionDays: additionalDays
      };

      if (isOnline) {
        await updateCredit(credit.id, updateData);
      } else {
        await addToQueue('CREDIT_UPDATE', {
          creditNoteId: credit.id,
          ...updateData
        }, 'HIGH');
      }

      // Update local state
      setExpiringCredits(prev => prev.map(c => 
        c.id === credit.id 
          ? { ...c, expiresAt: newExpiry.toISOString() }
          : c
      ));

      // Remove from expired if it was there
      setExpiredCredits(prev => prev.filter(c => c.id !== credit.id));

      // Acknowledge related alerts
      setAlerts(prev => prev.map(alert => 
        alert.creditNoteId === credit.id 
          ? { ...alert, acknowledged: true, actionTaken: `Extended ${additionalDays} days` }
          : alert
      ));

      api.toast.show(
        `Credit extended to ${newExpiry.toLocaleDateString()}`,
        'success'
      );

      if (onCreditUpdated) {
        onCreditUpdated({ ...credit, expiresAt: newExpiry.toISOString() });
      }

    } catch (error) {
      api.toast.show('Failed to extend credit expiration', 'error');
    } finally {
      setLoading(false);
    }
  }, [isOnline, updateCredit, addToQueue, onCreditUpdated, api.toast]);

  /**
   * Acknowledge alert
   */
  const acknowledgeAlert = useCallback((alertId: string, actionTaken?: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, acknowledged: true, actionTaken }
        : alert
    ));
  }, []);

  /**
   * Get days until expiration
   */
  const getDaysUntilExpiration = useCallback((expiresAt: string): number => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, []);

  /**
   * Get expiration status badge
   */
  const getExpirationBadge = useCallback((credit: CreditNote) => {
    if (!credit.expiresAt) return null;

    const days = getDaysUntilExpiration(credit.expiresAt);
    
    if (days < 0) {
      return <Badge status="critical">Expired</Badge>;
    } else if (days <= 3) {
      return <Badge status="critical">{days}d left</Badge>;
    } else if (days <= 7) {
      return <Badge status="warning">{days}d left</Badge>;
    } else if (days <= 30) {
      return <Badge status="info">{days}d left</Badge>;
    }
    
    return <Badge status="success">{days}d left</Badge>;
  }, [getDaysUntilExpiration]);

  return (
    <Navigator>
      <Screen name="ExpirationManager" title="Expiration Management">
        <ScrollView>
          <Stack spacing="base">
            {/* Alert Summary */}
            {alerts.filter(a => !a.acknowledged).length > 0 && (
              <Banner status="warning">
                <Text>
                  {alerts.filter(a => !a.acknowledged).length} pending expiration alerts
                </Text>
              </Banner>
            )}

            {/* Tab Navigation */}
            <Stack direction="horizontal" spacing="tight">
              <Button
                onPress={() => setActiveTab('expiring')}
                title={`Expiring (${expiringCredits.length})`}
                variant={activeTab === 'expiring' ? 'primary' : 'secondary'}
                fullWidth
              />
              <Button
                onPress={() => setActiveTab('expired')}
                title={`Expired (${expiredCredits.length})`}
                variant={activeTab === 'expired' ? 'primary' : 'secondary'}
                fullWidth
              />
              <Button
                onPress={() => setActiveTab('alerts')}
                title={`Alerts (${alerts.filter(a => !a.acknowledged).length})`}
                variant={activeTab === 'alerts' ? 'primary' : 'secondary'}
                fullWidth
              />
            </Stack>


            {/* Expiring Credits Tab */}
            {activeTab === 'expiring' && (
              <Stack spacing="base">
                <Stack direction="horizontal" alignment="space-between">
                  <Text variant="headingSm">Credits Expiring Soon</Text>
                  <Button
                    onPress={loadExpirationData}
                    title="Refresh"
                    variant="secondary"
                    size="small"
                    loading={loading}
                  />
                </Stack>

                {expiringCredits.length === 0 ? (
                  <Text variant="bodySm" color="subdued">
                    No credits expiring in the next 60 days
                  </Text>
                ) : (
                  expiringCredits.slice(0, 20).map(credit => (
                    <Stack key={credit.id} spacing="base">
                      <Stack direction="horizontal" alignment="space-between">
                        <Stack spacing="extraTight">
                          <Text variant="bodySm" color="emphasis">
                            {formatCreditNoteNumber(credit.noteNumber)}
                          </Text>
                          <Text variant="bodySm">
                            {credit.customerName} • {formatCreditAmount(credit.remainingAmount, credit.currency)}
                          </Text>
                          <Text variant="bodySm" color="subdued">
                            Expires: {new Date(credit.expiresAt!).toLocaleDateString()}
                          </Text>
                        </Stack>
                        
                        <Stack spacing="extraTight" alignment="end">
                          {getExpirationBadge(credit)}
                          <Button
                            onPress={() => setSelectedCredit(credit)}
                            title="Extend"
                            variant="secondary"
                            size="small"
                          />
                        </Stack>
                      </Stack>
                      
                    </Stack>
                  ))
                )}
              </Stack>
            )}

            {/* Expired Credits Tab */}
            {activeTab === 'expired' && (
              <Stack spacing="base">
                <Text variant="headingSm">Expired Credits</Text>

                {expiredCredits.length === 0 ? (
                  <Text variant="bodySm" color="subdued">
                    No expired credits found
                  </Text>
                ) : (
                  expiredCredits.slice(0, 20).map(credit => (
                    <Stack key={credit.id} spacing="base">
                      <Stack direction="horizontal" alignment="space-between">
                        <Stack spacing="extraTight">
                          <Text variant="bodySm" color="emphasis">
                            {formatCreditNoteNumber(credit.noteNumber)}
                          </Text>
                          <Text variant="bodySm">
                            {credit.customerName} • {formatCreditAmount(credit.remainingAmount, credit.currency)}
                          </Text>
                          <Text variant="bodySm" color="critical">
                            Expired: {new Date(credit.expiresAt!).toLocaleDateString()}
                          </Text>
                        </Stack>
                        
                        <Stack spacing="extraTight" alignment="end">
                          <Badge status="critical">
                            {Math.abs(getDaysUntilExpiration(credit.expiresAt!))}d ago
                          </Badge>
                          <Button
                            onPress={() => setSelectedCredit(credit)}
                            title="Reactivate"
                            variant="secondary"
                            size="small"
                          />
                        </Stack>
                      </Stack>
                      
                    </Stack>
                  ))
                )}
              </Stack>
            )}

            {/* Alerts Tab */}
            {activeTab === 'alerts' && (
              <Stack spacing="base">
                <Text variant="headingSm">Expiration Alerts</Text>

                {alerts.length === 0 ? (
                  <Text variant="bodySm" color="subdued">
                    No expiration alerts
                  </Text>
                ) : (
                  alerts.slice(0, 20).map(alert => (
                    <Stack key={alert.id} spacing="base">
                      <Stack direction="horizontal" alignment="space-between">
                        <Stack spacing="extraTight">
                          <Stack direction="horizontal" spacing="tight" alignment="center">
                            <Badge 
                              status={
                                alert.priority === 'HIGH' ? 'critical' : 
                                alert.priority === 'MEDIUM' ? 'warning' : 'info'
                              }
                            >
                              {alert.priority}
                            </Badge>
                            <Text variant="bodySm" color="emphasis">
                              {formatCreditNoteNumber(alert.creditNote.noteNumber)}
                            </Text>
                          </Stack>
                          
                          <Text variant="bodySm">
                            {alert.alertType === 'EXPIRED' 
                              ? `Expired ${Math.abs(alert.daysUntilExpiration)} days ago`
                              : `Expires in ${alert.daysUntilExpiration} days`
                            }
                          </Text>
                          
                          <Text variant="bodySm" color="subdued">
                            {alert.creditNote.customerName} • {formatCreditAmount(alert.creditNote.remainingAmount)}
                          </Text>
                          
                          {alert.actionTaken && (
                            <Text variant="bodySm" color="success">
                              Action: {alert.actionTaken}
                            </Text>
                          )}
                        </Stack>
                        
                        <Stack spacing="extraTight" alignment="end">
                          {!alert.acknowledged && (
                            <Button
                              onPress={() => acknowledgeAlert(alert.id)}
                              title="Acknowledge"
                              variant="secondary"
                              size="small"
                            />
                          )}
                          <Text variant="bodySm" color="subdued">
                            {new Date(alert.createdAt).toLocaleDateString()}
                          </Text>
                        </Stack>
                      </Stack>
                      
                    </Stack>
                  ))
                )}
              </Stack>
            )}
          </Stack>
        </ScrollView>
      </Screen>

      {/* Credit Extension Screen */}
      {selectedCredit && (
        <Screen name="ExtendCredit" title={`Extend ${formatCreditNoteNumber(selectedCredit.noteNumber)}`}>
          <ScrollView>
            <Stack spacing="base">
              <Text variant="headingSm">Extend Credit Expiration</Text>
              
              <Stack spacing="tight">
                <Text variant="bodySm">
                  Customer: {selectedCredit.customerName}
                </Text>
                <Text variant="bodySm">
                  Current Balance: {formatCreditAmount(selectedCredit.remainingAmount, selectedCredit.currency)}
                </Text>
                <Text variant="bodySm">
                  Current Expiry: {selectedCredit.expiresAt ? new Date(selectedCredit.expiresAt).toLocaleDateString() : 'No expiry'}
                </Text>
                {selectedCredit.expiresAt && (
                  <Text variant="bodySm" color={getDaysUntilExpiration(selectedCredit.expiresAt) < 0 ? 'critical' : 'warning'}>
                    Status: {getDaysUntilExpiration(selectedCredit.expiresAt) < 0 ? 'Expired' : `${getDaysUntilExpiration(selectedCredit.expiresAt)} days remaining`}
                  </Text>
                )}
              </Stack>

              <TextField
                label="Extension Period (days)"
                value={extensionDays.toString()}
                onChange={(value) => setExtensionDays(parseInt(value) || 30)}
                type="number"
                min="1"
                max="365"
              />

              <TextField
                label="Reason for Extension"
                value={extensionReason}
                onChange={setExtensionReason}
                placeholder="e.g., Customer request, system error, promotional extension"
                multiline={3}
              />

              {selectedCredit.expiresAt && (
                <Text variant="bodySm" color="success">
                  New expiry date: {new Date(
                    new Date(selectedCredit.expiresAt).getTime() + (extensionDays * 24 * 60 * 60 * 1000)
                  ).toLocaleDateString()}
                </Text>
              )}

              <Stack direction="horizontal" spacing="tight">
                <Button
                  onPress={() => {
                    extendCreditExpiration(selectedCredit, extensionDays, extensionReason);
                    setSelectedCredit(null);
                    setExtensionReason('');
                  }}
                  title={`Extend ${extensionDays} Days`}
                  variant="primary"
                  loading={loading}
                  disabled={loading || !extensionReason.trim()}
                  fullWidth
                />
                
                <Button
                  onPress={() => {
                    setSelectedCredit(null);
                    setExtensionReason('');
                  }}
                  title="Cancel"
                  variant="secondary"
                  fullWidth
                />
              </Stack>

              {/* Quick Extension Options */}
              <Stack spacing="base">
                <Text variant="headingSm">Quick Extensions</Text>
                <Stack direction="horizontal" spacing="tight">
                  {[30, 60, 90, 180].map(days => (
                    <Button
                      key={days}
                      onPress={() => setExtensionDays(days)}
                      title={`${days}d`}
                      variant={extensionDays === days ? 'primary' : 'secondary'}
                      size="small"
                      fullWidth
                    />
                  ))}
                </Stack>
              </Stack>
            </Stack>
          </ScrollView>
        </Screen>
      )}
    </Navigator>
  );
};

export default ExpirationManager;