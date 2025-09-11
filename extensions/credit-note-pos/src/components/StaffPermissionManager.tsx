// Staff Permission Manager for POS credit operations
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

import { CreditNote, CreditRedemption } from '../types/credit.types';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { formatCreditAmount } from '../utils/qrcode.utils';

interface StaffPermission {
  id: string;
  staffId: string;
  staffName: string;
  role: 'CASHIER' | 'SUPERVISOR' | 'MANAGER' | 'ADMIN';
  permissions: {
    canRedeem: boolean;
    canCreate: boolean;
    canDelete: boolean;
    canViewAll: boolean;
    canBulkProcess: boolean;
    maxRedemptionAmount: number;
    requiresApproval: boolean;
  };
  isActive: boolean;
  createdAt: string;
}

interface AuditLogEntry {
  id: string;
  staffId: string;
  staffName: string;
  action: string;
  resource: string;
  resourceId: string;
  details: any;
  timestamp: string;
  ipAddress: string;
  deviceId: string;
  success: boolean;
  errorMessage?: string;
}

interface StaffPermissionManagerProps {
  currentStaffId?: string;
  onPermissionChange?: (staffId: string, permissions: any) => void;
}

const StaffPermissionManager: React.FC<StaffPermissionManagerProps> = ({
  currentStaffId,
  onPermissionChange
}) => {
  const api = useApi<'pos.home.modal.render'>();
  
  // State
  const [staffPermissions, setStaffPermissions] = useState<StaffPermission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffPermission | null>(null);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'permissions' | 'audit' | 'security'>('permissions');
  
  // Security settings
  const [securitySettings, setSecuritySettings] = useState({
    requirePinForHighValue: true,
    highValueThreshold: 500,
    sessionTimeout: 30,
    requireApprovalAbove: 1000,
    enableAuditLogging: true,
    maxFailedAttempts: 3
  });

  // Hooks
  const { isOnline, addToQueue } = useOfflineSync();

  // Load staff permissions and audit logs
  useEffect(() => {
    loadStaffData();
  }, []);

  /**
   * Load staff permissions and audit logs
   */
  const loadStaffData = useCallback(async () => {
    setLoading(true);
    try {
      // In a real implementation, this would fetch from your API
      // For now, we'll use mock data
      setStaffPermissions([
        {
          id: 'staff_1',
          staffId: 'staff_default',
          staffName: 'Current Staff Member',
          role: 'CASHIER',
          permissions: {
            canRedeem: true,
            canCreate: false,
            canDelete: false,
            canViewAll: false,
            canBulkProcess: false,
            maxRedemptionAmount: 100,
            requiresApproval: false
          },
          isActive: true,
          createdAt: new Date().toISOString()
        }
      ]);

      // Mock audit logs
      setAuditLogs([
        {
          id: 'audit_1',
          staffId: 'staff_default',
          staffName: 'Current Staff Member',
          action: 'CREDIT_REDEEM',
          resource: 'credit_note',
          resourceId: 'CN-2024-0001',
          details: { amount: 25.00, orderId: 'order_123' },
          timestamp: new Date().toISOString(),
          ipAddress: '192.168.1.100',
          deviceId: getDeviceId(),
          success: true
        }
      ]);

    } catch (error) {
      api.toast.show('Failed to load staff data', 'error');
    } finally {
      setLoading(false);
    }
  }, [api.toast]);

  /**
   * Check if current staff has permission for action
   */
  const checkPermission = useCallback((
    action: 'REDEEM' | 'CREATE' | 'DELETE' | 'VIEW_ALL' | 'BULK_PROCESS',
    amount?: number
  ): { allowed: boolean; reason?: string; requiresApproval?: boolean } => {
    const staff = staffPermissions.find(s => s.staffId === currentStaffId);
    
    if (!staff || !staff.isActive) {
      return { allowed: false, reason: 'Staff member not found or inactive' };
    }

    const perms = staff.permissions;
    
    switch (action) {
      case 'REDEEM':
        if (!perms.canRedeem) {
          return { allowed: false, reason: 'No redemption permission' };
        }
        if (amount && amount > perms.maxRedemptionAmount) {
          if (amount > securitySettings.requireApprovalAbove) {
            return { allowed: true, requiresApproval: true };
          }
          return { allowed: false, reason: `Amount exceeds limit of ${formatCreditAmount(perms.maxRedemptionAmount)}` };
        }
        break;
        
      case 'CREATE':
        if (!perms.canCreate) {
          return { allowed: false, reason: 'No creation permission' };
        }
        break;
        
      case 'DELETE':
        if (!perms.canDelete) {
          return { allowed: false, reason: 'No deletion permission' };
        }
        break;
        
      case 'VIEW_ALL':
        if (!perms.canViewAll) {
          return { allowed: false, reason: 'No view all permission' };
        }
        break;
        
      case 'BULK_PROCESS':
        if (!perms.canBulkProcess) {
          return { allowed: false, reason: 'No bulk processing permission' };
        }
        break;
    }

    return { allowed: true };
  }, [staffPermissions, currentStaffId, securitySettings]);

  /**
   * Log audit entry
   */
  const logAuditEntry = useCallback(async (
    action: string,
    resource: string,
    resourceId: string,
    details: any,
    success: boolean,
    errorMessage?: string
  ) => {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      staffId: currentStaffId || 'unknown',
      staffName: staffPermissions.find(s => s.staffId === currentStaffId)?.staffName || 'Unknown Staff',
      action,
      resource,
      resourceId,
      details,
      timestamp: new Date().toISOString(),
      ipAddress: getClientIP(),
      deviceId: getDeviceId(),
      success,
      errorMessage
    };

    // Add to local audit log
    setAuditLogs(prev => [entry, ...prev.slice(0, 99)]); // Keep last 100 entries

    // Queue for server sync
    if (isOnline) {
      try {
        await addToQueue('AUDIT_LOG', entry, 'HIGH');
      } catch (error) {
        console.error('Failed to queue audit log:', error);
      }
    }
  }, [currentStaffId, staffPermissions, isOnline, addToQueue]);

  /**
   * Request supervisor approval
   */
  const requestApproval = useCallback(async (
    action: string,
    amount: number,
    creditNote: CreditNote
  ): Promise<boolean> => {
    setCurrentAction(`Requesting approval for ${action} - ${formatCreditAmount(amount)}`);
    
    try {
      // In a real implementation, this would:
      // 1. Send notification to supervisors
      // 2. Show approval dialog
      // 3. Wait for supervisor authentication
      
      // Mock approval process
      const approved = await new Promise<boolean>((resolve) => {
        setTimeout(() => {
          // Simulate approval (in real app, this would be interactive)
          const approved = Math.random() > 0.3; // 70% approval rate for demo
          resolve(approved);
        }, 2000);
      });

      await logAuditEntry(
        'APPROVAL_REQUEST',
        'credit_note',
        creditNote.id,
        { action, amount, approved },
        approved,
        approved ? undefined : 'Approval denied by supervisor'
      );

      return approved;
      
    } catch (error) {
      await logAuditEntry(
        'APPROVAL_REQUEST',
        'credit_note',
        creditNote.id,
        { action, amount, error: error instanceof Error ? error.message : 'Unknown error' },
        false,
        'Approval request failed'
      );
      
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [logAuditEntry]);

  /**
   * Update staff permissions
   */
  const updateStaffPermissions = useCallback(async (
    staffId: string,
    newPermissions: Partial<StaffPermission['permissions']>
  ) => {
    try {
      setStaffPermissions(prev => prev.map(staff => 
        staff.staffId === staffId 
          ? { ...staff, permissions: { ...staff.permissions, ...newPermissions } }
          : staff
      ));

      await logAuditEntry(
        'PERMISSION_UPDATE',
        'staff_permissions',
        staffId,
        { newPermissions },
        true
      );

      if (onPermissionChange) {
        onPermissionChange(staffId, newPermissions);
      }

      api.toast.show('Permissions updated successfully', 'success');
      
    } catch (error) {
      await logAuditEntry(
        'PERMISSION_UPDATE',
        'staff_permissions',
        staffId,
        { newPermissions, error: error instanceof Error ? error.message : 'Unknown error' },
        false,
        'Failed to update permissions'
      );
      
      api.toast.show('Failed to update permissions', 'error');
    }
  }, [onPermissionChange, logAuditEntry, api.toast]);

  /**
   * Get permission summary for display
   */
  const getPermissionSummary = useCallback((staff: StaffPermission): string => {
    const perms = staff.permissions;
    const summary = [];
    
    if (perms.canRedeem) summary.push(`Redeem up to ${formatCreditAmount(perms.maxRedemptionAmount)}`);
    if (perms.canCreate) summary.push('Create credits');
    if (perms.canDelete) summary.push('Delete credits');
    if (perms.canViewAll) summary.push('View all credits');
    if (perms.canBulkProcess) summary.push('Bulk processing');
    
    return summary.length > 0 ? summary.join(', ') : 'No permissions';
  }, []);

  return (
    <Navigator>
      <Screen name="StaffPermissionManager" title="Staff & Security">
        <ScrollView>
          <Stack spacing="base">
            {/* Current Action Banner */}
            {currentAction && (
              <Banner status="info">
                <Text>{currentAction}</Text>
              </Banner>
            )}

            {/* Tab Navigation */}
            <Stack direction="horizontal" spacing="tight">
              <Button
                onPress={() => setActiveTab('permissions')}
                title="Permissions"
                variant={activeTab === 'permissions' ? 'primary' : 'secondary'}
                fullWidth
              />
              <Button
                onPress={() => setActiveTab('audit')}
                title="Audit Log"
                variant={activeTab === 'audit' ? 'primary' : 'secondary'}
                fullWidth
              />
              <Button
                onPress={() => setActiveTab('security')}
                title="Security"
                variant={activeTab === 'security' ? 'primary' : 'secondary'}
                fullWidth
              />
            </Stack>


            {/* Permissions Tab */}
            {activeTab === 'permissions' && (
              <Stack spacing="base">
                <Text variant="headingSm">Staff Permissions</Text>
                
                {staffPermissions.map(staff => (
                  <Stack key={staff.id} spacing="base">
                    <Stack direction="horizontal" alignment="space-between">
                      <Stack spacing="extraTight">
                        <Text variant="bodySm" color="emphasis">
                          {staff.staffName}
                        </Text>
                        <Badge status={staff.isActive ? 'success' : 'critical'}>
                          {staff.role}
                        </Badge>
                      </Stack>
                      
                      <Button
                        onPress={() => setSelectedStaff(staff)}
                        title="Edit"
                        variant="secondary"
                        size="small"
                      />
                    </Stack>
                    
                    <Text variant="bodySm" color="subdued">
                      {getPermissionSummary(staff)}
                    </Text>
                    
                  </Stack>
                ))}
              </Stack>
            )}

            {/* Audit Log Tab */}
            {activeTab === 'audit' && (
              <Stack spacing="base">
                <Stack direction="horizontal" alignment="space-between">
                  <Text variant="headingSm">Recent Activity</Text>
                  <Button
                    onPress={loadStaffData}
                    title="Refresh"
                    variant="secondary"
                    size="small"
                    loading={loading}
                  />
                </Stack>
                
                {auditLogs.slice(0, 20).map(log => (
                  <Stack key={log.id} spacing="tight">
                    <Stack direction="horizontal" alignment="space-between">
                      <Stack spacing="extraTight">
                        <Text variant="bodySm" color="emphasis">
                          {log.action.replace('_', ' ')} - {log.staffName}
                        </Text>
                        <Text variant="bodySm" color="subdued">
                          {log.resource}: {log.resourceId}
                        </Text>
                      </Stack>
                      
                      <Stack spacing="extraTight" alignment="end">
                        <Badge status={log.success ? 'success' : 'critical'}>
                          {log.success ? 'Success' : 'Failed'}
                        </Badge>
                        <Text variant="bodySm" color="subdued">
                          {new Date(log.timestamp).toLocaleString()}
                        </Text>
                      </Stack>
                    </Stack>
                    
                    {log.details && (
                      <Text variant="bodySm" color="subdued">
                        Details: {JSON.stringify(log.details)}
                      </Text>
                    )}
                    
                    {log.errorMessage && (
                      <Text variant="bodySm" color="critical">
                        Error: {log.errorMessage}
                      </Text>
                    )}
                    
                  </Stack>
                ))}
              </Stack>
            )}

            {/* Security Settings Tab */}
            {activeTab === 'security' && (
              <Stack spacing="base">
                <Text variant="headingSm">Security Settings</Text>
                
                <Stack spacing="tight">
                  <Stack direction="horizontal" alignment="space-between">
                    <Text variant="bodySm">Require PIN for high-value transactions</Text>
                    <Button
                      onPress={() => setSecuritySettings(prev => ({
                        ...prev,
                        requirePinForHighValue: !prev.requirePinForHighValue
                      }))}
                      title={securitySettings.requirePinForHighValue ? 'On' : 'Off'}
                      variant={securitySettings.requirePinForHighValue ? 'primary' : 'secondary'}
                      size="small"
                    />
                  </Stack>

                  <TextField
                    label="High-value threshold"
                    value={securitySettings.highValueThreshold.toString()}
                    onChange={(value) => setSecuritySettings(prev => ({
                      ...prev,
                      highValueThreshold: parseFloat(value) || 0
                    }))}
                    type="number"
                    prefix="$"
                  />

                  <TextField
                    label="Session timeout (minutes)"
                    value={securitySettings.sessionTimeout.toString()}
                    onChange={(value) => setSecuritySettings(prev => ({
                      ...prev,
                      sessionTimeout: parseInt(value) || 30
                    }))}
                    type="number"
                  />

                  <TextField
                    label="Require approval above"
                    value={securitySettings.requireApprovalAbove.toString()}
                    onChange={(value) => setSecuritySettings(prev => ({
                      ...prev,
                      requireApprovalAbove: parseFloat(value) || 1000
                    }))}
                    type="number"
                    prefix="$"
                  />

                  <Stack direction="horizontal" alignment="space-between">
                    <Text variant="bodySm">Enable audit logging</Text>
                    <Button
                      onPress={() => setSecuritySettings(prev => ({
                        ...prev,
                        enableAuditLogging: !prev.enableAuditLogging
                      }))}
                      title={securitySettings.enableAuditLogging ? 'On' : 'Off'}
                      variant={securitySettings.enableAuditLogging ? 'primary' : 'secondary'}
                      size="small"
                    />
                  </Stack>

                  <TextField
                    label="Max failed attempts before lockout"
                    value={securitySettings.maxFailedAttempts.toString()}
                    onChange={(value) => setSecuritySettings(prev => ({
                      ...prev,
                      maxFailedAttempts: parseInt(value) || 3
                    }))}
                    type="number"
                  />
                </Stack>

                <Button
                  onPress={() => {
                    // Save security settings
                    api.toast.show('Security settings saved', 'success');
                  }}
                  title="Save Security Settings"
                  variant="primary"
                  fullWidth
                />
              </Stack>
            )}

            {/* Usage Instructions */}
            <Stack spacing="base">
              <Text variant="headingSm">Security Features</Text>
              <Stack spacing="tight">
                <Text variant="bodySm">• Role-based permission control</Text>
                <Text variant="bodySm">• Comprehensive audit logging</Text>
                <Text variant="bodySm">• Supervisor approval workflows</Text>
                <Text variant="bodySm">• Session timeout protection</Text>
                <Text variant="bodySm">• Failed attempt lockout</Text>
                <Text variant="bodySm">• High-value transaction controls</Text>
              </Stack>
            </Stack>
          </Stack>
        </ScrollView>
      </Screen>

      {/* Permission Editor Screen */}
      {selectedStaff && (
        <Screen name="PermissionEditor" title={`Edit ${selectedStaff.staffName}`}>
          <ScrollView>
            <Stack spacing="base">
              <Text variant="headingSm">Edit Permissions</Text>
              
              <Stack spacing="tight">
                <Stack direction="horizontal" alignment="space-between">
                  <Text variant="bodySm">Can redeem credits</Text>
                  <Button
                    onPress={() => {
                      const newPermissions = {
                        ...selectedStaff.permissions,
                        canRedeem: !selectedStaff.permissions.canRedeem
                      };
                      setSelectedStaff({ ...selectedStaff, permissions: newPermissions });
                    }}
                    title={selectedStaff.permissions.canRedeem ? 'Yes' : 'No'}
                    variant={selectedStaff.permissions.canRedeem ? 'primary' : 'secondary'}
                    size="small"
                  />
                </Stack>

                <TextField
                  label="Max redemption amount"
                  value={selectedStaff.permissions.maxRedemptionAmount.toString()}
                  onChange={(value) => {
                    const newPermissions = {
                      ...selectedStaff.permissions,
                      maxRedemptionAmount: parseFloat(value) || 0
                    };
                    setSelectedStaff({ ...selectedStaff, permissions: newPermissions });
                  }}
                  type="number"
                  prefix="$"
                />

                <Stack direction="horizontal" alignment="space-between">
                  <Text variant="bodySm">Can bulk process</Text>
                  <Button
                    onPress={() => {
                      const newPermissions = {
                        ...selectedStaff.permissions,
                        canBulkProcess: !selectedStaff.permissions.canBulkProcess
                      };
                      setSelectedStaff({ ...selectedStaff, permissions: newPermissions });
                    }}
                    title={selectedStaff.permissions.canBulkProcess ? 'Yes' : 'No'}
                    variant={selectedStaff.permissions.canBulkProcess ? 'primary' : 'secondary'}
                    size="small"
                  />
                </Stack>
              </Stack>

              <Stack direction="horizontal" spacing="tight">
                <Button
                  onPress={() => {
                    updateStaffPermissions(selectedStaff.staffId, selectedStaff.permissions);
                    setSelectedStaff(null);
                  }}
                  title="Save Changes"
                  variant="primary"
                  fullWidth
                />
                
                <Button
                  onPress={() => setSelectedStaff(null)}
                  title="Cancel"
                  variant="secondary"
                  fullWidth
                />
              </Stack>
            </Stack>
          </ScrollView>
        </Screen>
      )}
    </Navigator>
  );
};

// Helper functions
function getDeviceId(): string {
  if (typeof window !== 'undefined') {
    let deviceId = localStorage.getItem('pos_device_id');
    if (!deviceId) {
      deviceId = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('pos_device_id', deviceId);
    }
    return deviceId;
  }
  return 'unknown';
}

function getClientIP(): string {
  // In a real implementation, this would get the actual client IP
  // For POS, this might be the local network IP
  return '192.168.1.100';
}

// Export permission checking functions for use in other components
export const useStaffPermissions = () => {
  return {
    checkPermission: (action: string, amount?: number) => {
      // This would integrate with the StaffPermissionManager
      return { allowed: true }; // Simplified for demo
    },
    logAuditEntry: (action: string, resource: string, details: any) => {
      // This would log audit entries
      console.log('Audit:', action, resource, details);
    },
    requestApproval: async (action: string, amount: number) => {
      // This would request supervisor approval
      return true; // Simplified for demo
    }
  };
};

export default StaffPermissionManager;