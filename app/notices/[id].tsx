/**
 * Notice Detail Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  MessageSquare,
  Paperclip,
  Play,
  User,
} from 'lucide-react-native';
import { useNotice, useWorkflowProgress, useAttachments, useAdvanceWorkflow } from '../../src/hooks/useNotices';
import { useNoticeTasks, useComments } from '../../src/hooks/useTasks';
import { LoadingSpinner, Button, EmptyState } from '../../src/components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, RISK_COLORS, STATUS_COLORS } from '../../src/utils/constants';
import { NoticeDetailDto, TaskDto, CommentResponseDto } from '../../src/types';

type TabType = 'overview' | 'analysis' | 'tasks' | 'comments';

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [refreshing, setRefreshing] = useState(false);

  // Ensure id is defined
  const noticeId = id ?? '';

  const { data: notice, isLoading, refetch: refetchNotice } = useNotice(noticeId);
  const { data: workflow, refetch: refetchWorkflow } = useWorkflowProgress(noticeId);
  const { data: tasksData, refetch: refetchTasks } = useNoticeTasks(noticeId);
  const { data: commentsData, refetch: refetchComments } = useComments(noticeId);
  const { data: attachments, refetch: refetchAttachments } = useAttachments(noticeId);

  const advanceWorkflowMutation = useAdvanceWorkflow();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchNotice(),
      refetchWorkflow(),
      refetchTasks(),
      refetchComments(),
      refetchAttachments(),
    ]);
    setRefreshing(false);
  };

  if (isLoading || !notice) {
    return <LoadingSpinner fullScreen message="Loading notice..." />;
  }

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'analysis', label: 'Analysis' },
    { key: 'tasks', label: 'Tasks', count: tasksData?.tasks.length },
    { key: 'comments', label: 'Comments', count: commentsData?.comments.length },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Header Card */}
        <NoticeHeader notice={notice} />

        {/* Workflow Progress */}
        {workflow && <WorkflowProgress workflow={workflow} />}

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
                {tab.count !== undefined && ` (${tab.count})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && <OverviewTab notice={notice} />}
          {activeTab === 'analysis' && <AnalysisTab notice={notice} />}
          {activeTab === 'tasks' && (
            <TasksTab tasks={tasksData?.tasks || []} noticeId={noticeId} />
          )}
          {activeTab === 'comments' && (
            <CommentsTab comments={commentsData?.comments || []} noticeId={noticeId} />
          )}
        </View>

        {/* Attachments Summary */}
        {attachments && attachments.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.attachmentsSummary}>
              <Paperclip size={20} color={COLORS.gray[500]} />
              <Text style={styles.attachmentsText}>
                {attachments.length} attachment{attachments.length > 1 ? 's' : ''}
              </Text>
              <ChevronRight size={20} color={COLORS.gray[300]} />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action */}
      {workflow && workflow.stages.length > 0 && (
        <View style={styles.bottomAction}>
          <Button
            title="Advance Workflow"
            onPress={() => {
              // Would show transition options
            }}
            icon={<Play size={18} color={COLORS.white} />}
            fullWidth
          />
        </View>
      )}
    </View>
  );
}

// Notice Header Component
function NoticeHeader({ notice }: { notice: NoticeDetailDto }) {
  const getRiskColor = (riskLevel?: string) => {
    if (!riskLevel) return COLORS.gray[400];
    return RISK_COLORS[riskLevel as keyof typeof RISK_COLORS] || COLORS.gray[400];
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return `₹${amount.toLocaleString()}`;
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.noticeType}>{notice.noticeType || 'Notice'}</Text>
          {notice.noticeNumber && (
            <Text style={styles.noticeNumber}>#{notice.noticeNumber}</Text>
          )}
        </View>
        {notice.riskLevel && (
          <View style={[styles.riskBadge, { backgroundColor: getRiskColor(notice.riskLevel) }]}>
            <Text style={styles.riskText}>
              {notice.riskLevel.toUpperCase()} RISK
            </Text>
          </View>
        )}
      </View>

      <View style={styles.headerStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatCurrency(notice.taxAmount)}</Text>
          <Text style={styles.statLabel}>Demand</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text
            style={[
              styles.statValue,
              notice.daysRemaining !== undefined &&
                notice.daysRemaining < 0 && { color: COLORS.error },
            ]}
          >
            {notice.daysRemaining !== undefined
              ? notice.daysRemaining < 0
                ? `${Math.abs(notice.daysRemaining)} days overdue`
                : `${notice.daysRemaining} days`
              : '-'}
          </Text>
          <Text style={styles.statLabel}>Deadline</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{notice.riskScore || '-'}</Text>
          <Text style={styles.statLabel}>Risk Score</Text>
        </View>
      </View>
    </View>
  );
}

// Workflow Progress Component
function WorkflowProgress({
  workflow,
}: {
  workflow: { stages: Array<{ name: string; isCompleted: boolean; isCurrentStage: boolean }> };
}) {
  return (
    <View style={styles.workflowSection}>
      <Text style={styles.sectionTitle}>Workflow Progress</Text>
      <View style={styles.workflowStages}>
        {workflow.stages.map((stage, index) => (
          <React.Fragment key={stage.name}>
            <View style={styles.workflowStage}>
              <View
                style={[
                  styles.stageIndicator,
                  stage.isCompleted && styles.stageCompleted,
                  stage.isCurrentStage && styles.stageCurrent,
                ]}
              >
                {stage.isCompleted ? (
                  <CheckCircle size={16} color={COLORS.white} />
                ) : (
                  <Text style={styles.stageNumber}>{index + 1}</Text>
                )}
              </View>
              <Text
                style={[
                  styles.stageName,
                  stage.isCurrentStage && styles.stageNameActive,
                ]}
                numberOfLines={1}
              >
                {stage.name}
              </Text>
            </View>
            {index < workflow.stages.length - 1 && (
              <View
                style={[
                  styles.stageConnector,
                  stage.isCompleted && styles.stageConnectorActive,
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// Overview Tab
function OverviewTab({ notice }: { notice: NoticeDetailDto }) {
  return (
    <View>
      <InfoRow label="Notice Type" value={notice.noticeType} />
      <InfoRow label="Category" value={notice.noticeCategory} />
      <InfoRow label="GSTIN" value={notice.gstin} />
      <InfoRow label="Issue Date" value={notice.issueDate ? new Date(notice.issueDate).toLocaleDateString() : '-'} />
      <InfoRow label="Response Deadline" value={notice.responseDeadline ? new Date(notice.responseDeadline).toLocaleDateString() : '-'} />
      <InfoRow label="Issuing Authority" value={notice.issuingAuthority} />
      <InfoRow label="Period" value={notice.periodFrom && notice.periodTo ? `${new Date(notice.periodFrom).toLocaleDateString()} - ${new Date(notice.periodTo).toLocaleDateString()}` : '-'} />
      {notice.tags && notice.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          <Text style={styles.infoLabel}>Tags</Text>
          <View style={styles.tags}>
            {notice.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// Analysis Tab
function AnalysisTab({ notice }: { notice: NoticeDetailDto }) {
  const report = notice.aiReport;

  if (!report) {
    return (
      <EmptyState
        title="No Analysis Yet"
        message="AI analysis is being processed. You'll be notified when it's ready."
        icon={<FileText size={48} color={COLORS.gray[400]} />}
      />
    );
  }

  return (
    <View>
      {/* Summary */}
      {report.summaryEn && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>Summary</Text>
          <Text style={styles.analysisText}>{report.summaryEn}</Text>
        </View>
      )}

      {/* Plain English Explanation */}
      {report.plainEnglish && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>What This Means</Text>
          <Text style={styles.analysisText}>{report.plainEnglish}</Text>
        </View>
      )}

      {/* Action Items */}
      {report.actionItems && report.actionItems.length > 0 && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>Action Items</Text>
          {report.actionItems.map((item, index) => (
            <View key={index} style={styles.actionItem}>
              <View
                style={[
                  styles.actionPriority,
                  { backgroundColor: RISK_COLORS[item.priority] || COLORS.gray[400] },
                ]}
              />
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{item.action}</Text>
                <Text style={styles.actionDescription}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Required Documents */}
      {report.requiredDocuments && report.requiredDocuments.length > 0 && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>Required Documents</Text>
          {report.requiredDocuments.map((doc, index) => (
            <View key={index} style={styles.documentItem}>
              <Paperclip size={16} color={COLORS.gray[500]} />
              <Text style={styles.documentText}>{doc.document}</Text>
              {doc.mandatory && (
                <View style={styles.mandatoryBadge}>
                  <Text style={styles.mandatoryText}>Required</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// Tasks Tab
function TasksTab({ tasks, noticeId }: { tasks: TaskDto[]; noticeId: string }) {
  if (tasks.length === 0) {
    return <EmptyState type="tasks" />;
  }

  return (
    <View>
      {tasks.map((task) => (
        <View key={task.id} style={styles.taskItem}>
          <View
            style={[
              styles.taskPriority,
              { backgroundColor: RISK_COLORS[task.priority] || COLORS.gray[400] },
            ]}
          />
          <View style={styles.taskContent}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <View style={styles.taskMeta}>
              {task.assignees.length > 0 && (
                <View style={styles.assignees}>
                  <User size={12} color={COLORS.gray[400]} />
                  <Text style={styles.assigneeText}>
                    {task.assignees.map((a) => a.name).join(', ')}
                  </Text>
                </View>
              )}
              {task.dueDate && (
                <View style={styles.dueDate}>
                  <Clock size={12} color={task.isOverdue ? COLORS.error : COLORS.gray[400]} />
                  <Text
                    style={[styles.dueDateText, task.isOverdue && { color: COLORS.error }]}
                  >
                    {new Date(task.dueDate).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: STATUS_COLORS[task.status] || COLORS.gray[400] },
            ]}
          >
            <Text style={styles.statusText}>{task.status.replace('_', ' ')}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// Comments Tab
function CommentsTab({ comments, noticeId }: { comments: CommentResponseDto[]; noticeId: string }) {
  if (comments.length === 0) {
    return (
      <EmptyState
        title="No Comments Yet"
        message="Start the conversation by adding a comment."
        icon={<MessageSquare size={48} color={COLORS.gray[400]} />}
      />
    );
  }

  return (
    <View>
      {comments.map((comment) => (
        <View key={comment.id} style={styles.commentItem}>
          <View style={styles.commentAvatar}>
            <Text style={styles.commentAvatarText}>
              {comment.author.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentAuthor}>{comment.author.name}</Text>
              <Text style={styles.commentTime}>
                {new Date(comment.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.commentText}>{comment.content}</Text>
            {comment.reactions.length > 0 && (
              <View style={styles.reactions}>
                {comment.reactions.map((reaction) => (
                  <View key={reaction.emoji} style={styles.reaction}>
                    <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                    <Text style={styles.reactionCount}>{reaction.count}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

// Info Row Component
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  scroll: {
    flex: 1,
  },
  header: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  noticeType: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  noticeNumber: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  riskBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  riskText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.white,
  },
  headerStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  statItem: {
    flex: 1,
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
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.gray[200],
    marginHorizontal: SPACING.md,
  },
  workflowSection: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray[500],
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
  },
  workflowStages: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workflowStage: {
    alignItems: 'center',
    flex: 1,
  },
  stageIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stageCompleted: {
    backgroundColor: COLORS.success,
  },
  stageCurrent: {
    backgroundColor: COLORS.primary,
  },
  stageNumber: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray[500],
  },
  stageName: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
    textAlign: 'center',
  },
  stageNameActive: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  stageConnector: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.gray[200],
    marginHorizontal: 4,
    marginBottom: 20,
  },
  stageConnectorActive: {
    backgroundColor: COLORS.success,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  tab: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    marginRight: SPACING.md,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  tabContent: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    minHeight: 200,
  },
  section: {
    backgroundColor: COLORS.white,
    marginTop: SPACING.sm,
    padding: SPACING.md,
  },
  attachmentsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  attachmentsText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[700],
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  infoLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
  },
  infoValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
    fontWeight: '500',
  },
  tagsContainer: {
    paddingVertical: SPACING.sm,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  tag: {
    backgroundColor: COLORS.gray[100],
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  tagText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
  analysisSection: {
    marginBottom: SPACING.lg,
  },
  analysisSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: SPACING.sm,
  },
  analysisText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[700],
    lineHeight: 22,
  },
  actionItem: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  actionPriority: {
    width: 4,
    borderRadius: 2,
    marginRight: SPACING.sm,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[900],
  },
  actionDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  documentText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[700],
  },
  mandatoryBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  mandatoryText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
    fontWeight: '500',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  taskPriority: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: SPACING.md,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[900],
  },
  taskMeta: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: 4,
  },
  assignees: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assigneeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  dueDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDateText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
    color: COLORS.white,
    textTransform: 'capitalize',
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  commentAvatarText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[900],
  },
  commentTime: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[400],
  },
  commentText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[700],
    lineHeight: 20,
  },
  reactions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray[100],
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  reactionEmoji: {
    fontSize: FONT_SIZES.sm,
  },
  reactionCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
});
