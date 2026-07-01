/**
 * GSTN Portal Integrations Settings Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Link2, RefreshCw, Settings, History, Zap, AlertCircle, Clock } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';

import { useGstnConnections, useInitiateConnection, useTriggerSync } from '../../src/hooks/useGstn';
import { GstnConnection, GstnConnectionStatus, getStatusLabel, canConnect, canSync } from '../../src/types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

// Sanitize error messages to prevent XSS/injection
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>"'&]/g, '') // Remove special chars
    .substring(0, 200); // Limit length
}

export default function IntegrationsScreen() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useGstnConnections();
  const initiateConnection = useInitiateConnection();
  const triggerSync = useTriggerSync();

  const handleConnect = async (connection: GstnConnection) => {
    try {
      const result = await initiateConnection.mutateAsync(connection.organizationGstinId);
      if (result.success && result.otpDestination) {
        router.push({
          pathname: '/settings/gstn-otp',
          params: {
            gstinId: connection.organizationGstinId,
            gstin: connection.gstin,
            destination: result.otpDestination,
          },
        });
      }
    } catch (e) {
      // Error handled by hook
    }
  };

  const handleSync = (connection: GstnConnection) => {
    triggerSync.mutate(connection.organizationGstinId);
  };

  const handleSettings = (connection: GstnConnection) => {
    router.push({
      pathname: '/settings/gstn-settings',
      params: {
        gstinId: connection.organizationGstinId,
        gstin: connection.gstin,
      },
    });
  };

  const handleHistory = (connection: GstnConnection) => {
    router.push({
      pathname: '/settings/gstn-history',
      params: {
        gstinId: connection.organizationGstinId,
        gstin: connection.gstin,
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case GstnConnectionStatus.Connected:
        return COLORS.success;
      case GstnConnectionStatus.PendingOtp:
        return COLORS.warning;
      case GstnConnectionStatus.TokenExpired:
      case GstnConnectionStatus.Suspended:
      case GstnConnectionStatus.Revoked:
        return COLORS.error;
      default:
        return COLORS.gray[400];
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'GST Portal Integration',
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
            <Text style={styles.infoTitle}>Auto-Fetch Notices</Text>
          </View>
          <Text style={styles.infoText}>
            Connect your GSTINs to automatically fetch notices from the GST Portal.
            You'll need to verify with an OTP sent to your registered mobile/email.
          </Text>
        </View>

        {/* Connections */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading connections...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <AlertCircle size={40} color={COLORS.error} />
            <Text style={styles.errorText}>Failed to load connections</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : data?.connections.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Link2 size={40} color={COLORS.gray[400]} />
            <Text style={styles.emptyText}>No GSTINs found</Text>
            <Text style={styles.emptySubtext}>
              Add GSTINs to your organization first
            </Text>
          </View>
        ) : (
          <View style={styles.connectionsList}>
            <Text style={styles.sectionTitle}>
              Your GSTINs ({data?.connections.filter(c => c.isConnected).length}/{data?.total} connected)
            </Text>

            {data?.connections.map((connection) => (
              <ConnectionCard
                key={connection.organizationGstinId}
                connection={connection}
                onConnect={() => handleConnect(connection)}
                onSync={() => handleSync(connection)}
                onSettings={() => handleSettings(connection)}
                onHistory={() => handleHistory(connection)}
                isConnecting={initiateConnection.isPending}
                isSyncing={triggerSync.isPending}
                getStatusColor={getStatusColor}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

interface ConnectionCardProps {
  connection: GstnConnection;
  onConnect: () => void;
  onSync: () => void;
  onSettings: () => void;
  onHistory: () => void;
  isConnecting: boolean;
  isSyncing: boolean;
  getStatusColor: (status: string) => string;
}

function ConnectionCard({
  connection,
  onConnect,
  onSync,
  onSettings,
  onHistory,
  isConnecting,
  isSyncing,
  getStatusColor,
}: ConnectionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.gstin}>{connection.gstin}</Text>
          {connection.tradeName && (
            <Text style={styles.tradeName}>{connection.tradeName}</Text>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: `${getStatusColor(connection.status)}20` },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor(connection.status) }]}>
            {getStatusLabel(connection.status)}
          </Text>
        </View>
      </View>

      {connection.isConnected ? (
        <>
          {/* Connection Info */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Auto-sync</Text>
            <Text style={styles.infoValue}>
              {connection.autoSyncEnabled
                ? `Every ${connection.syncIntervalHours}h`
                : 'Disabled'}
            </Text>
          </View>

          {connection.lastSyncAt && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last synced</Text>
              <Text style={styles.infoValue}>
                {formatDistanceToNow(new Date(connection.lastSyncAt), { addSuffix: true })}
              </Text>
            </View>
          )}

          {connection.lastSyncError && (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color={COLORS.error} />
              <Text style={styles.errorBannerText} numberOfLines={2}>
                {sanitizeErrorMessage(connection.lastSyncError)}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onSync}
              disabled={!canSync(connection.status) || isSyncing}
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
              <Text style={[styles.actionButtonText, { color: COLORS.gray[600] }]}>
                Settings
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={onHistory}>
              <History size={18} color={COLORS.gray[600]} />
              <Text style={[styles.actionButtonText, { color: COLORS.gray[600] }]}>
                History
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.disconnectedText}>
            {connection.status === GstnConnectionStatus.TokenExpired
              ? 'Session expired. Reconnect to continue syncing.'
              : connection.status === GstnConnectionStatus.Suspended
              ? 'Connection suspended. Reconnect to resume.'
              : 'Connect to automatically fetch notices.'}
          </Text>

          <TouchableOpacity
            style={styles.connectButton}
            onPress={onConnect}
            disabled={!canConnect(connection.status) || isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Link2 size={18} color={COLORS.white} />
                <Text style={styles.connectButtonText}>Connect to GST Portal</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  connectionsList: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: SPACING.md,
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
  gstin: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: COLORS.gray[900],
  },
  tradeName: {
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  actionButtonText: {
    marginLeft: SPACING.xs,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.primary,
  },
  disconnectedText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: SPACING.md,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  connectButtonText: {
    marginLeft: SPACING.sm,
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});
