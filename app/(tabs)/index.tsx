import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, Clock, FileText, ChevronRight } from 'lucide-react-native';

export default function HomeScreen() {
  const router = useRouter();

  // Mock data - replace with actual API calls
  const stats = {
    critical: 3,
    open: 12,
    dueSoon: 5,
    overdue: 2,
  };

  const upcomingDeadlines = [
    { id: '1', type: 'DRC-01', amount: '₹8.4L', daysRemaining: 3, risk: 'critical' },
    { id: '2', type: 'ASMT-10', amount: '₹2.1L', daysRemaining: 7, risk: 'high' },
    { id: '3', type: 'REG-17', amount: '-', daysRemaining: 12, risk: 'medium' },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>Good Morning, Rajesh</Text>
        <Text style={styles.greetingSubtext}>Here's your compliance overview</Text>
      </View>

      {/* Critical Alert Banner */}
      {stats.critical > 0 && (
        <TouchableOpacity style={styles.alertBanner}>
          <AlertCircle color="#dc2626" size={20} />
          <Text style={styles.alertText}>
            {stats.critical} Critical Notices require immediate attention
          </Text>
          <ChevronRight color="#dc2626" size={20} />
        </TouchableOpacity>
      )}

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          label="Open"
          value={stats.open}
          color="#0ea5e9"
          onPress={() => router.push('/notices?status=open')}
        />
        <StatCard
          label="Due Soon"
          value={stats.dueSoon}
          color="#eab308"
          onPress={() => router.push('/notices?filter=due-soon')}
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          color="#ef4444"
          onPress={() => router.push('/notices?filter=overdue')}
        />
      </View>

      {/* Upcoming Deadlines */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Deadlines</Text>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>

        {upcomingDeadlines.map((notice) => (
          <TouchableOpacity
            key={notice.id}
            style={styles.noticeCard}
            onPress={() => router.push(`/notices/${notice.id}`)}
          >
            <View style={styles.noticeIcon}>
              <FileText color="#6b7280" size={24} />
            </View>
            <View style={styles.noticeInfo}>
              <Text style={styles.noticeType}>{notice.type}</Text>
              <Text style={styles.noticeAmount}>{notice.amount}</Text>
            </View>
            <View style={styles.noticeDeadline}>
              <View style={[styles.riskBadge, styles[`risk_${notice.risk}`]]}>
                <Clock color="#fff" size={12} />
                <Text style={styles.riskBadgeText}>{notice.daysRemaining} days</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <QuickActionButton
            label="Upload Notice"
            icon="📤"
            onPress={() => router.push('/upload')}
          />
          <QuickActionButton
            label="View Tasks"
            icon="✅"
            onPress={() => router.push('/tasks')}
          />
          <QuickActionButton
            label="Contact CA"
            icon="👤"
            onPress={() => {}}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
  color,
  onPress,
}: {
  label: string;
  value: number;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function QuickActionButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickActionButton} onPress={onPress}>
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  greeting: {
    padding: 20,
    backgroundColor: '#0ea5e9',
  },
  greetingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  greetingSubtext: {
    fontSize: 14,
    color: '#e0f2fe',
    marginTop: 4,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  alertText: {
    flex: 1,
    marginLeft: 8,
    color: '#dc2626',
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  sectionLink: {
    fontSize: 14,
    color: '#0ea5e9',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  noticeIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  noticeType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  noticeAmount: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  noticeDeadline: {
    alignItems: 'flex-end',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  risk_critical: {
    backgroundColor: '#ef4444',
  },
  risk_high: {
    backgroundColor: '#f97316',
  },
  risk_medium: {
    backgroundColor: '#eab308',
  },
  risk_low: {
    backgroundColor: '#22c55e',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
});
