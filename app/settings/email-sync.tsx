/**
 * Email Sync Settings Screen
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  Mail,
  RefreshCw,
  Settings,
  History,
  Zap,
  AlertCircle,
  Shield,
  Link2Off,
} from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';

import {
  useEmailAccounts,
  useInitiateEmailConnection,
  useTriggerEmailSync,
  useDisconnectEmail,
} from '../../src/hooks/useEmailSync';
import {
  EmailAccount,
  EmailAccountStatus,
  getSyncStatusLabel,
  getProviderLabel,
  getSyncStatusColor,
  canSync,
  needsReconnect,
} from '../../src/types/emailSync';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import { useColors, useThemedStyles } from '../../src/theme/useTheme';
import type { Palette } from '../../src/theme/palettes';
import { useTranslation } from '../../src/hooks';
import { getEmailConnectionError } from '../../src/utils/email-sync-errors';


export default function EmailSyncScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const router = useRouter();
  const { email_sync: connectionResult } = useLocalSearchParams<{ email_sync?: string }>();
  const handledResult = useRef<string | undefined>(undefined);
  const { data, isLoading, error, refetch, isRefetching } = useEmailAccounts();
  const initiateConnection = useInitiateEmailConnection();
  const triggerSync = useTriggerEmailSync();
  const disconnectEmail = useDisconnectEmail();

  useEffect(() => {
    if (!connectionResult || handledResult.current === connectionResult) return;
    handledResult.current = connectionResult;
    Alert.alert(connectionResult === 'connected' ? 'Email connected' : 'Connection not completed',
      connectionResult === 'connected' ? 'Your email is ready for daily GST notice sync.' : getEmailConnectionError(connectionResult));
    router.setParams({ email_sync: undefined });
    void refetch();
  }, [connectionResult, router, refetch]);

  const handleConnect = async (provider: 'gmail' | 'outlook') => {
    try {
      // Use app scheme for redirect
      const redirectUri = 'effortlessinsight://settings/email-sync';
      const result = await initiateConnection.mutateAsync({
        provider,
        redirectUri,
      });

      if (result.success && result.authorizationUrl) {
        // Open browser for OAuth
        const authResult = await WebBrowser.openAuthSessionAsync(
          result.authorizationUrl,
          redirectUri
        );

        if (authResult.type === 'success' && authResult.url) {
          const url = new URL(authResult.url);
          const status = url.searchParams.get('email_sync');
          Alert.alert(status === 'connected' ? 'Email connected' : 'Connection not completed',
            status === 'connected' ? 'Your email is ready for daily GST notice sync.' : getEmailConnectionError(status ?? 'connection_failed'));
          await refetch();
        }
      }
    } catch (e) {
      // Error handled by hooks
    }
  };

  const handleSync = (account: EmailAccount) => {
    triggerSync.mutate(account.id);
  };

  const handleSettings = (account: EmailAccount) => {
    router.push({
      pathname: '/settings/email-sync-settings',
      params: {
        accountId: account.id,
        email: account.email,
      },
    });
  };

  const handleHistory = (account: EmailAccount) => {
    router.push({
      pathname: '/settings/email-sync-history',
      params: {
        accountId: account.id,
        email: account.email,
      },
    });
  };

  const handleDisconnect = (account: EmailAccount) => {
    Alert.alert(
      'Disconnect Email',
      `Are you sure you want to disconnect ${account.email}? This will stop automatic GST notice detection from this email.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => disconnectEmail.mutate(account.id),
        },
      ]
    );
  };

  const isConnecting = initiateConnection.isPending;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Email Sync',
          headerRight: () => (
            <TouchableOpacity onPress={() => refetch()} style={styles.headerButton}>
              <RefreshCw size={20} color={COLORS.white} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Zap size={20} color={COLORS.primary} />
            <Text style={styles.infoTitle}>Automatic GST Notice Detection</Text>
          </View>
          <Text style={styles.infoText}>
            Connect your Gmail or Microsoft Outlook to automatically scan for GST notices.
            We only read emails from GST authorities and never access your other emails.
          </Text>
        </View>

        {/* Connect Buttons */}
        <View style={styles.connectSection}>
          <Text style={styles.sectionTitle}>Connect Email</Text>
          <View style={styles.connectButtons}>
            <TouchableOpacity
              style={[styles.connectButton, { borderColor: '#ea4335' }]}
              onPress={() => handleConnect('gmail')}
              disabled={isConnecting}
            >
              {initiateConnection.isPending ? (
                <ActivityIndicator size="small" color="#ea4335" />
              ) : (
                <>
                  <Mail size={24} color="#ea4335" />
                  <Text style={[styles.connectButtonText, { color: '#ea4335' }]}>Gmail</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.connectButton, { borderColor: '#0078d4' }]}
              onPress={() => handleConnect('outlook')}
              disabled={isConnecting}
            >
              {initiateConnection.isPending ? (
                <ActivityIndicator size="small" color="#0078d4" />
              ) : (
                <>
                  <Mail size={24} color="#0078d4" />
                  <Text style={[styles.connectButtonText, { color: '#0078d4' }]}>Microsoft</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Connected Accounts */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading accounts...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <AlertCircle size={40} color={COLORS.error} />
            <Text style={styles.errorText}>Failed to load accounts</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : data?.accounts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Mail size={40} color={COLORS.gray[400]} />
            <Text style={styles.emptyText}>No email accounts connected</Text>
            <Text style={styles.emptySubtext}>
              Connect your Gmail or Outlook above to start automatically importing GST notices.
            </Text>
          </View>
        ) : (
          <View style={styles.accountsList}>
            <Text style={styles.sectionTitle}>
              Connected Accounts ({data?.accounts.filter(a => a.isConnected).length}/{data?.total})
            </Text>

            {data?.accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onSync={() => handleSync(account)}
                onSettings={() => handleSettings(account)}
                onHistory={() => handleHistory(account)}
                onDisconnect={() => handleDisconnect(account)}
                onReconnect={() => handleConnect(account.provider)}
                isSyncing={triggerSync.isPending}
                isReconnecting={isConnecting}
              />
            ))}
          </View>
        )}

        {/* Privacy Note */}
        <View style={styles.privacyCard}>
          <Shield size={20} color={COLORS.primary} />
          <View style={styles.privacyContent}>
            <Text style={styles.privacyTitle}>Your privacy is protected</Text>
            <Text style={styles.privacyText}>
              We only access emails from verified GST authority addresses. Your personal emails
              are never read or stored.
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

interface AccountCardProps {
  account: EmailAccount;
  onSync: () => void;
  onSettings: () => void;
  onHistory: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  isSyncing: boolean;
  isReconnecting: boolean;
}

function AccountCard({
  account,
  onSync,
  onSettings,
  onHistory,
  onDisconnect,
  onReconnect,
  isSyncing,
  isReconnecting,
}: AccountCardProps) {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const statusColor = getSyncStatusColor(account);
  const [showDetails, setShowDetails] = useState(false);
  const showReconnect = needsReconnect(account.status);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Mail size={20} color={COLORS.gray[600]} />
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{account.displayName || account.email}</Text>
            {account.displayName && (
              <Text style={styles.cardSubtitle}>{account.email}</Text>
            )}
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.statusText, { color: statusColor.text }]}>
            {getSyncStatusLabel(account)}
          </Text>
        </View>
      </View>

      {account.isConnected && !showReconnect ? (
        <>
          {/* Info Rows */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Provider</Text>
            <Text style={styles.infoValue}>{getProviderLabel(account.provider)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Auto-sync</Text>
            <Text style={styles.infoValue}>
              {account.autoSyncEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
          {account.lastSyncAt && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last synced</Text>
              <Text style={styles.infoValue}>
                {formatDistanceToNow(new Date(account.lastSyncAt), { addSuffix: true })}
              </Text>
            </View>
          )}

          {/* Last Sync Result */}
          {account.lastSyncResult && (
            <View style={styles.syncStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{account.lastSyncResult.emailsScanned}</Text>
                <Text style={styles.statLabel}>Scanned</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: COLORS.success }]}>
                  {account.lastSyncResult.noticesImported}
                </Text>
                <Text style={styles.statLabel}>Imported</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{account.lastSyncResult.duplicatesSkipped + account.lastSyncResult.attachmentsSkipped}</Text>
                <Text style={styles.statLabel}>Skipped</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{account.lastSyncResult.failedToProcess}</Text>
                <Text style={styles.statLabel}>Needs attention</Text>
              </View>
            </View>
          )}

          {account.lastSyncResult?.emailsScanned === 0 && !account.lastSyncError && (
            <Text style={styles.statLabel}>
              No new emails from approved GST senders were found in this scan. Newly received
              emails become eligible after 10 minutes. Older emails outside the initial scan
              period and previously scanned emails are not fetched again.
            </Text>
          )}

          {/* Error */}
          {account.lastSyncError && (
            <View style={[styles.errorBanner, { backgroundColor: statusColor.bg }]}>
              <AlertCircle size={16} color={statusColor.text} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.errorBannerText, { color: statusColor.text }]}>{getSyncStatusLabel(account)}</Text>
                <TouchableOpacity onPress={() => setShowDetails(!showDetails)} accessibilityRole="button">
                  <Text style={[styles.errorBannerText, { color: statusColor.text }]}>{showDetails ? 'Hide details' : 'View details'}</Text>
                </TouchableOpacity>
                {showDetails && <Text style={[styles.errorBannerText, { color: statusColor.text }]}>{account.lastSyncError}</Text>}
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onSync}
              disabled={!canSync(account.status) || isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <RefreshCw size={18} color={COLORS.primary} />
              )}
              <Text style={styles.actionButtonText}>Sync</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={onSettings}>
              <Settings size={18} color={COLORS.gray[600]} />
              <Text style={[styles.actionButtonText, { color: COLORS.gray[600] }]}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={onHistory}>
              <History size={18} color={COLORS.gray[600]} />
              <Text style={[styles.actionButtonText, { color: COLORS.gray[600] }]}>History</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={onDisconnect}>
              <Link2Off size={18} color={COLORS.error} />
              <Text style={[styles.actionButtonText, { color: COLORS.error }]}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.disconnectedText}>
            {showReconnect
              ? 'Your email connection needs to be re-authorized. Please reconnect to continue syncing.'
              : 'Connect to automatically detect GST notices from your email.'}
          </Text>

          {showReconnect && (
            <TouchableOpacity
              style={styles.reconnectButton}
              onPress={onReconnect}
              disabled={isReconnecting}
            >
              {isReconnecting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Mail size={18} color={COLORS.white} />
                  <Text style={styles.reconnectButtonText}>Reconnect</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.gray[100],
    },
    headerButton: {
      padding: SPACING.sm,
    },
    infoCard: {
      backgroundColor: `${COLORS.primary}10`,
      margin: SPACING.md,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: `${COLORS.primary}30`,
    },
    infoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    infoTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '600',
      color: COLORS.gray[900],
      marginLeft: SPACING.sm,
    },
    infoText: {
      fontSize: FONT_SIZES.sm,
      color: COLORS.gray[600],
      lineHeight: 20,
    },
    connectSection: {
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.md,
    },
    sectionTitle: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: COLORS.gray[700],
      marginBottom: SPACING.md,
    },
    connectButtons: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    connectButton: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.lg,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 2,
      backgroundColor: COLORS.white,
    },
    connectButtonText: {
      marginTop: SPACING.sm,
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
    },
    loadingContainer: {
      padding: SPACING.xl,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: SPACING.md,
      color: COLORS.gray[600],
    },
    errorContainer: {
      padding: SPACING.xl,
      alignItems: 'center',
    },
    errorText: {
      marginTop: SPACING.md,
      color: COLORS.error,
      fontSize: FONT_SIZES.md,
    },
    retryButton: {
      marginTop: SPACING.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      backgroundColor: COLORS.primary,
      borderRadius: BORDER_RADIUS.md,
    },
    retryButtonText: {
      color: COLORS.white,
      fontWeight: '600',
    },
    emptyContainer: {
      padding: SPACING.xl,
      alignItems: 'center',
    },
    emptyText: {
      marginTop: SPACING.md,
      fontSize: FONT_SIZES.lg,
      fontWeight: '600',
      color: COLORS.gray[600],
    },
    emptySubtext: {
      marginTop: SPACING.xs,
      color: COLORS.gray[500],
      textAlign: 'center',
      paddingHorizontal: SPACING.lg,
    },
    accountsList: {
      padding: SPACING.md,
    },
    card: {
      backgroundColor: COLORS.white,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      shadowColor: COLORS.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: SPACING.md,
    },
    cardHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    cardTitleContainer: {
      marginLeft: SPACING.sm,
      flex: 1,
    },
    cardTitle: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: COLORS.gray[900],
    },
    cardSubtitle: {
      fontSize: FONT_SIZES.sm,
      color: COLORS.gray[600],
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
    },
    statusText: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '600',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: SPACING.xs,
    },
    infoLabel: {
      fontSize: FONT_SIZES.sm,
      color: COLORS.gray[500],
    },
    infoValue: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '500',
      color: COLORS.gray[700],
    },
    syncStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: SPACING.sm,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: COLORS.gray[200],
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '600',
      color: COLORS.gray[900],
    },
    statLabel: {
      fontSize: FONT_SIZES.xs,
      color: COLORS.gray[500],
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: `${COLORS.error}10`,
      padding: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      marginTop: SPACING.sm,
    },
    errorBannerText: {
      flex: 1,
      marginLeft: SPACING.sm,
      fontSize: FONT_SIZES.xs,
      color: COLORS.error,
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: SPACING.md,
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: COLORS.gray[200],
    },
    actionButton: {
      flexDirection: 'column',
      alignItems: 'center',
      padding: SPACING.xs,
    },
    actionButtonText: {
      marginTop: 4,
      fontSize: FONT_SIZES.xs,
      fontWeight: '500',
      color: COLORS.primary,
    },
    disconnectedText: {
      fontSize: FONT_SIZES.sm,
      color: COLORS.gray[600],
      marginBottom: SPACING.md,
    },
    reconnectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primary,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
    },
    reconnectButtonText: {
      marginLeft: SPACING.sm,
      color: COLORS.white,
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
    },
    privacyCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      margin: SPACING.md,
      padding: SPACING.md,
      backgroundColor: COLORS.white,
      borderRadius: BORDER_RADIUS.lg,
      marginBottom: SPACING.xl,
    },
    privacyContent: {
      flex: 1,
      marginLeft: SPACING.md,
    },
    privacyTitle: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: COLORS.gray[900],
    },
    privacyText: {
      fontSize: FONT_SIZES.sm,
      color: COLORS.gray[600],
      marginTop: SPACING.xs,
      lineHeight: 20,
    },
  });
