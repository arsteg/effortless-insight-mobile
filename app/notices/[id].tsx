/**
 * Notice Detail Screen
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
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
  Send,
  Plus,
  X,
  Download,
  Eye,
  File,
  Image,
} from 'lucide-react-native';
import { useNotice, useWorkflowProgress, useAttachments, useAdvanceWorkflow, useLatestResponse, useSaveDraft, useSubmitForReview, useApproveResponse, useMarkSubmitted, useNoticeDownloadUrl, useAttachmentDownloadUrl } from '../../src/hooks/useNotices';
import { useNoticeTasks, useComments, useCreateComment, useCreateTask, useDocumentRequests, useSubmitDocument, useNoticeActivity } from '../../src/hooks/useTasks';
import { useTranslation } from '../../src/hooks';
import * as DocumentPicker from 'expo-document-picker';
import { LoadingSpinner, Button, EmptyState } from '../../src/components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, RISK_COLORS, STATUS_COLORS } from '../../src/utils/constants';
import { NoticeDetailDto, TaskDto, CommentResponseDto, DocumentRequestDto, DocumentRequestStatus, ResponseDto, NoticeResponseStatus, ActivityDto, CommentVisibility } from '../../src/types';

type TabType = 'overview' | 'analysis' | 'response' | 'tasks' | 'comments' | 'documents' | 'activity';

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [downloadingAttachment, setDownloadingAttachment] = useState<string | null>(null);
  const [isViewingPdf, setIsViewingPdf] = useState(false);

  // Ensure id is defined
  const noticeId = id ?? '';

  const { data: notice, isLoading, isError, refetch: refetchNotice } = useNotice(noticeId);
  const noticeDownloadUrl = useNoticeDownloadUrl(noticeId);
  const attachmentDownloadUrl = useAttachmentDownloadUrl();
  const { data: workflow, refetch: refetchWorkflow } = useWorkflowProgress(noticeId);
  const { data: tasksData, refetch: refetchTasks } = useNoticeTasks(noticeId);
  const { data: commentsData, refetch: refetchComments } = useComments(noticeId);
  const { data: attachments, refetch: refetchAttachments } = useAttachments(noticeId);
  const { data: documentRequestsData, refetch: refetchDocRequests } = useDocumentRequests(noticeId);
  const { data: latestResponse, refetch: refetchResponse } = useLatestResponse(noticeId);
  const { data: activityData, refetch: refetchActivity, fetchNextPage: fetchNextActivity, hasNextPage: hasMoreActivity } = useNoticeActivity(noticeId);

  const advanceWorkflowMutation = useAdvanceWorkflow();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchNotice(),
      refetchWorkflow(),
      refetchTasks(),
      refetchComments(),
      refetchAttachments(),
      refetchDocRequests(),
      refetchResponse(),
      refetchActivity(),
    ]);
    setRefreshing(false);
  };

  const handleAdvanceWorkflow = (transitionKey: string, transitionLabel: string) => {
    Alert.alert(
      'Confirm Transition',
      `Are you sure you want to: ${transitionLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            advanceWorkflowMutation.mutate(
              { noticeId, transitionKey },
              {
                onSuccess: () => {
                  setShowTransitionModal(false);
                  Alert.alert('Success', 'Workflow advanced successfully');
                },
                onError: (error) => {
                  Alert.alert('Error', error.message || 'Failed to advance workflow');
                },
              }
            );
          },
        },
      ]
    );
  };

  const handleViewOriginalPdf = async () => {
    setIsViewingPdf(true);
    try {
      const result = await noticeDownloadUrl.mutateAsync();
      if (result.url) {
        await WebBrowser.openBrowserAsync(result.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          toolbarColor: COLORS.primary,
          controlsColor: COLORS.white,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load the PDF. Please try again.');
    } finally {
      setIsViewingPdf(false);
    }
  };

  const handleOpenAttachment = async (attachment: { id: string; fileName: string; downloadUrl?: string }) => {
    setDownloadingAttachment(attachment.id);
    try {
      // Get fresh download URL
      const result = await attachmentDownloadUrl.mutateAsync({
        noticeId,
        attachmentId: attachment.id,
      });

      if (result.url) {
        await WebBrowser.openBrowserAsync(result.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          toolbarColor: COLORS.primary,
          controlsColor: COLORS.white,
        });
      } else {
        Alert.alert('Error', 'Download URL not available');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open attachment');
    } finally {
      setDownloadingAttachment(null);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <Image size={20} color={COLORS.primary} />;
    }
    if (ext === 'pdf') {
      return <FileText size={20} color={COLORS.error} />;
    }
    return <File size={20} color={COLORS.gray[500]} />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading notice..." />;
  }

  // Error / deleted / not-found: show a recoverable state instead of an
  // infinite spinner (audit B10).
  if (isError || !notice) {
    return (
      <View style={styles.container}>
        <EmptyState
          type="error"
          title="Notice not available"
          message="This notice couldn't be loaded. It may have been deleted or you no longer have access."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'analysis', label: 'Analysis' },
    { key: 'response', label: 'Response' },
    { key: 'tasks', label: 'Tasks', count: tasksData?.tasks.length },
    { key: 'comments', label: 'Comments', count: commentsData?.comments.length },
    { key: 'documents', label: 'Docs', count: documentRequestsData?.requests.length },
    { key: 'activity', label: 'Activity' },
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
        <NoticeHeader
          notice={notice}
          onViewPdf={handleViewOriginalPdf}
          isViewingPdf={isViewingPdf}
        />

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
          {activeTab === 'response' && (
            <ResponseTab response={latestResponse} noticeId={noticeId} />
          )}
          {activeTab === 'tasks' && (
            <TasksTab tasks={tasksData?.tasks || []} noticeId={noticeId} />
          )}
          {activeTab === 'comments' && (
            <CommentsTab comments={commentsData?.comments || []} noticeId={noticeId} />
          )}
          {activeTab === 'documents' && (
            <DocumentRequestsTab
              requests={documentRequestsData?.requests || []}
              summary={documentRequestsData?.summary}
              noticeId={noticeId}
            />
          )}
          {activeTab === 'activity' && (
            <ActivityTab
              activities={activityData?.pages?.flatMap(page => page.activities || []) || []}
              hasMore={hasMoreActivity || false}
              onLoadMore={fetchNextActivity}
            />
          )}
        </View>

        {/* Attachments Summary */}
        {attachments && attachments.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.attachmentsSummary}
              onPress={() => setShowAttachmentsModal(true)}
            >
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
      {workflow && workflow.availableTransitions && workflow.availableTransitions.length > 0 && (
        <View style={styles.bottomAction}>
          <Button
            title="Advance Workflow"
            onPress={() => setShowTransitionModal(true)}
            icon={<Play size={18} color={COLORS.white} />}
            fullWidth
            disabled={advanceWorkflowMutation.isPending}
          />
        </View>
      )}

      {/* Workflow Transition Modal */}
      <Modal
        visible={showTransitionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTransitionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Transition</Text>
            <Text style={styles.modalSubtitle}>Choose an action to advance the workflow</Text>

            {workflow?.availableTransitions?.map((transition) => (
              <TouchableOpacity
                key={transition.key}
                style={styles.transitionOption}
                onPress={() => handleAdvanceWorkflow(transition.key, transition.label)}
                disabled={advanceWorkflowMutation.isPending}
              >
                <View style={styles.transitionContent}>
                  <Text style={styles.transitionLabel}>{transition.label}</Text>
                  {transition.description && (
                    <Text style={styles.transitionDescription}>{transition.description}</Text>
                  )}
                </View>
                <ChevronRight size={20} color={COLORS.gray[400]} />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowTransitionModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Attachments Modal */}
      <Modal
        visible={showAttachmentsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachmentsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.attachmentsModalContent}>
            <View style={styles.attachmentsModalHeader}>
              <Text style={styles.modalTitle}>Attachments</Text>
              <TouchableOpacity onPress={() => setShowAttachmentsModal(false)}>
                <X size={24} color={COLORS.gray[500]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.attachmentsList}>
              {attachments?.map((attachment) => (
                <TouchableOpacity
                  key={attachment.id}
                  style={styles.attachmentItem}
                  onPress={() => handleOpenAttachment(attachment)}
                  disabled={downloadingAttachment === attachment.id}
                >
                  <View style={styles.attachmentIcon}>
                    {getFileIcon(attachment.fileName)}
                  </View>
                  <View style={styles.attachmentInfo}>
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {attachment.fileName}
                    </Text>
                    <Text style={styles.attachmentSize}>
                      {formatFileSize(attachment.fileSize)}
                    </Text>
                  </View>
                  {downloadingAttachment === attachment.id ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Download size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.attachmentsCloseButton}
              onPress={() => setShowAttachmentsModal(false)}
            >
              <Text style={styles.attachmentsCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Notice Header Component
function NoticeHeader({
  notice,
  onViewPdf,
  isViewingPdf
}: {
  notice: NoticeDetailDto;
  onViewPdf: () => void;
  isViewingPdf: boolean;
}) {
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

      {/* View Original PDF Button */}
      <TouchableOpacity
        style={styles.viewPdfButton}
        onPress={onViewPdf}
        disabled={isViewingPdf}
      >
        {isViewingPdf ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <>
            <Eye size={18} color={COLORS.primary} />
            <Text style={styles.viewPdfButtonText}>View Original Notice PDF</Text>
          </>
        )}
      </TouchableOpacity>

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
  const { t, isHindi } = useTranslation();
  const report = notice.aiReport;

  if (!report) {
    return (
      <EmptyState
        title={t('analysis.noAnalysis')}
        message={t('analysis.analysisProcessing')}
        icon={<FileText size={48} color={COLORS.gray[400]} />}
      />
    );
  }

  // Get localized content - prefer Hindi if locale is Hindi and content available
  const summary = isHindi && report.summaryHi ? report.summaryHi : report.summaryEn;
  const plainExplanation = isHindi && report.plainHindi ? report.plainHindi : report.plainEnglish;

  return (
    <View>
      {/* Summary */}
      {summary && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>{t('analysis.summary')}</Text>
          <Text style={styles.analysisText}>{summary}</Text>
        </View>
      )}

      {/* Plain Language Explanation */}
      {plainExplanation && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>{t('analysis.whatThisMeans')}</Text>
          <Text style={styles.analysisText}>{plainExplanation}</Text>
        </View>
      )}

      {/* Action Items */}
      {report.actionItems && report.actionItems.length > 0 && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>{t('analysis.actionItems')}</Text>
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
          <Text style={styles.analysisSectionTitle}>{t('analysis.requiredDocuments')}</Text>
          {report.requiredDocuments.map((doc, index) => (
            <View key={index} style={styles.documentItem}>
              <Paperclip size={16} color={COLORS.gray[500]} />
              <Text style={styles.documentText}>{doc.document}</Text>
              {doc.mandatory && (
                <View style={styles.mandatoryBadge}>
                  <Text style={styles.mandatoryText}>{t('analysis.required')}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// Response Tab
function ResponseTab({ response, noticeId }: { response: ResponseDto | null | undefined; noticeId: string }) {
  const [draftContent, setDraftContent] = useState(response?.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitNotes, setSubmitNotes] = useState('');

  const saveDraft = useSaveDraft();
  const submitForReview = useSubmitForReview();
  const approveResponse = useApproveResponse();
  const markSubmitted = useMarkSubmitted();

  // Update draft content when response changes
  React.useEffect(() => {
    if (response?.content) {
      setDraftContent(response.content);
    }
  }, [response?.content]);

  const handleSaveDraft = useCallback(async () => {
    if (!draftContent.trim()) return;

    setIsSaving(true);
    try {
      await saveDraft.mutateAsync({
        noticeId,
        data: { content: draftContent.trim() },
      });
      Alert.alert('Success', 'Draft saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  }, [draftContent, noticeId, saveDraft]);

  const handleSubmitForReview = async () => {
    if (!response?.id) return;

    try {
      await submitForReview.mutateAsync({
        noticeId,
        responseId: response.id,
        data: submitNotes ? { notes: submitNotes } : undefined,
      });
      setShowSubmitModal(false);
      setSubmitNotes('');
      Alert.alert('Success', 'Response submitted for review');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit for review');
    }
  };

  const handleApprove = async () => {
    if (!response?.id) return;

    Alert.alert(
      'Approve Response',
      'Are you sure you want to approve this response?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await approveResponse.mutateAsync({
                noticeId,
                responseId: response.id,
              });
              Alert.alert('Success', 'Response approved');
            } catch (error) {
              Alert.alert('Error', 'Failed to approve response');
            }
          },
        },
      ]
    );
  };

  const handleMarkSubmitted = async () => {
    if (!response?.id) return;

    Alert.alert(
      'Mark as Submitted',
      'Mark this response as submitted to the authority?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await markSubmitted.mutateAsync({
                noticeId,
                responseId: response.id,
              });
              Alert.alert('Success', 'Response marked as submitted');
            } catch (error) {
              Alert.alert('Error', 'Failed to mark as submitted');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: NoticeResponseStatus) => {
    switch (status) {
      case 'draft': return COLORS.gray[500];
      case 'pending_review': return COLORS.warning;
      case 'approved': return COLORS.success;
      case 'submitted': return COLORS.info;
      case 'rejected': return COLORS.error;
      default: return COLORS.gray[500];
    }
  };

  const getStatusLabel = (status: NoticeResponseStatus) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'pending_review': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'submitted': return 'Submitted';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  return (
    <View style={styles.responseContainer}>
      {/* Status Badge */}
      {response && (
        <View style={styles.responseHeader}>
          <View style={[styles.responseStatusBadge, { backgroundColor: getStatusColor(response.status) }]}>
            <Text style={styles.responseStatusText}>{getStatusLabel(response.status)}</Text>
          </View>
          {response.version > 1 && (
            <Text style={styles.responseVersion}>Version {response.version}</Text>
          )}
        </View>
      )}

      {/* Draft Editor */}
      <View style={styles.draftEditorContainer}>
        <Text style={styles.draftLabel}>Response Content</Text>
        <TextInput
          style={styles.draftEditor}
          placeholder="Draft your response to this notice..."
          placeholderTextColor={COLORS.gray[400]}
          value={draftContent}
          onChangeText={setDraftContent}
          multiline
          textAlignVertical="top"
          editable={!response || response.status === 'draft' || response.status === 'rejected'}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.responseActions}>
        {(!response || response.status === 'draft' || response.status === 'rejected') && (
          <>
            <TouchableOpacity
              style={[styles.responseActionButton, styles.saveDraftButton]}
              onPress={handleSaveDraft}
              disabled={isSaving || !draftContent.trim()}
            >
              <Text style={styles.saveDraftButtonText}>
                {isSaving ? 'Saving...' : 'Save Draft'}
              </Text>
            </TouchableOpacity>

            {response?.id && (
              <TouchableOpacity
                style={[styles.responseActionButton, styles.submitButton]}
                onPress={() => setShowSubmitModal(true)}
                disabled={!draftContent.trim()}
              >
                <Text style={styles.submitButtonText}>Submit for Review</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {response?.status === 'pending_review' && (
          <TouchableOpacity
            style={[styles.responseActionButton, styles.approveButton]}
            onPress={handleApprove}
          >
            <CheckCircle size={18} color={COLORS.white} />
            <Text style={styles.approveButtonText}>Approve Response</Text>
          </TouchableOpacity>
        )}

        {response?.status === 'approved' && (
          <TouchableOpacity
            style={[styles.responseActionButton, styles.markSubmittedButton]}
            onPress={handleMarkSubmitted}
          >
            <Send size={18} color={COLORS.white} />
            <Text style={styles.markSubmittedButtonText}>Mark as Submitted</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Review Notes */}
      {response?.reviewNotes && (
        <View style={styles.reviewNotesContainer}>
          <Text style={styles.reviewNotesLabel}>Review Notes</Text>
          <Text style={styles.reviewNotesText}>{response.reviewNotes}</Text>
          {response.reviewedByName && (
            <Text style={styles.reviewedBy}>— {response.reviewedByName}</Text>
          )}
        </View>
      )}

      {/* Submit Modal */}
      <Modal
        visible={showSubmitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubmitModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.submitModalContent}>
            <Text style={styles.modalTitle}>Submit for Review</Text>
            <Text style={styles.modalSubtitle}>Add any notes for the reviewer</Text>

            <TextInput
              style={styles.submitNotesInput}
              placeholder="Notes (optional)"
              placeholderTextColor={COLORS.gray[400]}
              value={submitNotes}
              onChangeText={setSubmitNotes}
              multiline
              numberOfLines={3}
            />

            <View style={styles.submitModalActions}>
              <TouchableOpacity
                style={styles.submitModalCancel}
                onPress={() => setShowSubmitModal(false)}
              >
                <Text style={styles.submitModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitModalConfirm}
                onPress={handleSubmitForReview}
              >
                <Text style={styles.submitModalConfirmText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// Tasks Tab
function TasksTab({ tasks, noticeId }: { tasks: TaskDto[]; noticeId: string }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const createTask = useCreateTask();

  const handleCreateTask = useCallback(async () => {
    if (!newTaskTitle.trim()) return;

    try {
      await createTask.mutateAsync({
        noticeId,
        data: {
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || undefined,
          priority: newTaskPriority,
          assignees: [], // No assignees on quick create
        },
      });
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('medium');
      setShowCreateModal(false);
      Alert.alert('Success', 'Task created successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to create task. Please try again.');
    }
  }, [newTaskTitle, newTaskDescription, newTaskPriority, noticeId, createTask]);

  const priorities: Array<{ value: 'low' | 'medium' | 'high' | 'critical'; label: string }> = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  return (
    <View>
      {/* Add Task Button */}
      <TouchableOpacity
        style={styles.addTaskButton}
        onPress={() => setShowCreateModal(true)}
      >
        <Plus size={18} color={COLORS.primary} />
        <Text style={styles.addTaskButtonText}>Add Task</Text>
      </TouchableOpacity>

      {tasks.length === 0 ? (
        <EmptyState type="tasks" />
      ) : (
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
      )}

      {/* Create Task Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.createTaskModal}>
            <View style={styles.createTaskHeader}>
              <Text style={styles.createTaskTitle}>Create Task</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <X size={24} color={COLORS.gray[500]} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.taskTitleInput}
              placeholder="Task title"
              placeholderTextColor={COLORS.gray[400]}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              maxLength={200}
            />

            <TextInput
              style={styles.taskDescriptionInput}
              placeholder="Description (optional)"
              placeholderTextColor={COLORS.gray[400]}
              value={newTaskDescription}
              onChangeText={setNewTaskDescription}
              multiline
              numberOfLines={3}
              maxLength={2000}
            />

            <Text style={styles.priorityLabel}>Priority</Text>
            <View style={styles.prioritySelector}>
              {priorities.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.priorityOption,
                    newTaskPriority === p.value && styles.priorityOptionActive,
                    { borderColor: RISK_COLORS[p.value] || COLORS.gray[300] },
                    newTaskPriority === p.value && {
                      backgroundColor: RISK_COLORS[p.value] || COLORS.gray[300],
                    },
                  ]}
                  onPress={() => setNewTaskPriority(p.value)}
                >
                  <Text
                    style={[
                      styles.priorityOptionText,
                      newTaskPriority === p.value && styles.priorityOptionTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.createTaskActions}>
              <TouchableOpacity
                style={styles.createTaskCancelButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.createTaskCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.createTaskSubmitButton,
                  (!newTaskTitle.trim() || createTask.isPending) && styles.createTaskSubmitDisabled,
                ]}
                onPress={handleCreateTask}
                disabled={!newTaskTitle.trim() || createTask.isPending}
              >
                <Text style={styles.createTaskSubmitText}>
                  {createTask.isPending ? 'Creating...' : 'Create Task'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// Comments Tab
function CommentsTab({ comments, noticeId }: { comments: CommentResponseDto[]; noticeId: string }) {
  const [newComment, setNewComment] = useState('');
  const [visibility, setVisibility] = useState<CommentVisibility>('internal');
  const createComment = useCreateComment();

  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim()) return;

    try {
      await createComment.mutateAsync({
        noticeId,
        data: {
          content: newComment.trim(),
          visibility,
        },
      });
      setNewComment('');
    } catch (error) {
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    }
  }, [newComment, noticeId, createComment, visibility]);

  const getVisibilityColor = (vis: string) => {
    return vis === 'all' ? COLORS.warning : COLORS.info;
  };

  const renderCommentContent = (content: string, mentions?: { userId: string; name: string }[]) => {
    if (!mentions || mentions.length === 0) {
      return <Text style={styles.commentText}>{content}</Text>;
    }

    // Simple mention highlighting - replace @mentions with styled text
    let parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const mentionRegex = /@(\w+)/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      parts.push(
        <Text key={match.index} style={styles.mentionText}>
          {match[0]}
        </Text>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return <Text style={styles.commentText}>{parts}</Text>;
  };

  return (
    <View style={styles.commentsContainer}>
      {comments.length === 0 ? (
        <EmptyState
          title="No Comments Yet"
          message="Start the conversation by adding a comment."
          icon={<MessageSquare size={48} color={COLORS.gray[400]} />}
        />
      ) : (
        <View style={styles.commentsList}>
          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentItem}>
              <View style={styles.commentAvatar}>
                <Text style={styles.commentAvatarText}>
                  {comment.author.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.commentContent}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentAuthorRow}>
                    <Text style={styles.commentAuthor}>{comment.author.name}</Text>
                    {comment.visibility && (
                      <View style={[styles.visibilityBadge, { backgroundColor: getVisibilityColor(comment.visibility) + '20' }]}>
                        <Text style={[styles.visibilityBadgeText, { color: getVisibilityColor(comment.visibility) }]}>
                          {comment.visibility === 'all' ? 'All' : 'Internal'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.commentTime}>
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                {renderCommentContent(comment.content, comment.mentions)}
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
      )}

      {/* Comment Input with Visibility Toggle */}
      <View style={styles.commentComposeContainer}>
        {/* Visibility Toggle */}
        <View style={styles.visibilityToggle}>
          <TouchableOpacity
            style={[
              styles.visibilityOption,
              visibility === 'internal' && styles.visibilityOptionActive,
            ]}
            onPress={() => setVisibility('internal')}
          >
            <Text
              style={[
                styles.visibilityOptionText,
                visibility === 'internal' && styles.visibilityOptionTextActive,
              ]}
            >
              Internal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.visibilityOption,
              visibility === 'all' && styles.visibilityOptionActivePublic,
            ]}
            onPress={() => setVisibility('all')}
          >
            <Text
              style={[
                styles.visibilityOptionText,
                visibility === 'all' && styles.visibilityOptionTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
        </View>

        {/* Input Row */}
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder="Write a comment... Use @ to mention"
            placeholderTextColor={COLORS.gray[400]}
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newComment.trim() || createComment.isPending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSubmitComment}
            disabled={!newComment.trim() || createComment.isPending}
          >
            <Send size={20} color={newComment.trim() ? COLORS.white : COLORS.gray[400]} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Document Requests Tab
function DocumentRequestsTab({
  requests,
  summary,
  noticeId,
}: {
  requests: DocumentRequestDto[];
  summary?: { total: number; pending: number; submitted: number; fulfilled: number; overdue: number };
  noticeId: string;
}) {
  const [selectedRequest, setSelectedRequest] = useState<DocumentRequestDto | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadNote, setUploadNote] = useState('');
  const submitDocument = useSubmitDocument();

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: selectedRequest?.acceptedFormats?.map(f => `application/${f}`) || ['*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        submitDocument.mutate(
          {
            requestId: selectedRequest!.id,
            file: {
              uri: file.uri,
              type: file.mimeType || 'application/octet-stream',
              name: file.name,
            },
            note: uploadNote.trim() || undefined,
          },
          {
            onSuccess: () => {
              Alert.alert('Success', 'Document uploaded successfully');
              setShowUploadModal(false);
              setSelectedRequest(null);
              setUploadNote('');
            },
            onError: (error) => {
              Alert.alert('Error', error.message || 'Failed to upload document');
            },
          }
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const getStatusColor = (status: DocumentRequestStatus) => {
    switch (status) {
      case 'pending': return COLORS.warning;
      case 'submitted': return COLORS.info;
      case 'reviewing': return COLORS.primary;
      case 'fulfilled': return COLORS.success;
      case 'resubmit_needed': return COLORS.error;
      case 'cancelled': return COLORS.gray[400];
      default: return COLORS.gray[400];
    }
  };

  const getStatusLabel = (status: DocumentRequestStatus) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'submitted': return 'Submitted';
      case 'reviewing': return 'Reviewing';
      case 'fulfilled': return 'Fulfilled';
      case 'resubmit_needed': return 'Resubmit';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (requests.length === 0) {
    return (
      <EmptyState
        title="No Document Requests"
        message="No documents have been requested for this notice."
        icon={<FileText size={48} color={COLORS.gray[400]} />}
      />
    );
  }

  return (
    <View>
      {/* Summary badges */}
      {summary && (
        <View style={styles.docSummary}>
          <View style={[styles.docSummaryBadge, { backgroundColor: COLORS.warning + '20' }]}>
            <Text style={[styles.docSummaryText, { color: COLORS.warning }]}>
              {summary.pending} Pending
            </Text>
          </View>
          <View style={[styles.docSummaryBadge, { backgroundColor: COLORS.success + '20' }]}>
            <Text style={[styles.docSummaryText, { color: COLORS.success }]}>
              {summary.fulfilled} Done
            </Text>
          </View>
          {summary.overdue > 0 && (
            <View style={[styles.docSummaryBadge, { backgroundColor: COLORS.error + '20' }]}>
              <Text style={[styles.docSummaryText, { color: COLORS.error }]}>
                {summary.overdue} Overdue
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Request list */}
      {requests.map((request) => (
        <TouchableOpacity
          key={request.id}
          style={styles.docRequestItem}
          onPress={() => {
            if (request.status === 'pending' || request.status === 'resubmit_needed') {
              setSelectedRequest(request);
              setShowUploadModal(true);
            }
          }}
        >
          <View style={styles.docRequestHeader}>
            <View style={[styles.docRequestStatus, { backgroundColor: getStatusColor(request.status) }]}>
              <Text style={styles.docRequestStatusText}>{getStatusLabel(request.status)}</Text>
            </View>
            {request.isOverdue && (
              <View style={styles.overdueTag}>
                <AlertCircle size={12} color={COLORS.error} />
                <Text style={styles.overdueText}>Overdue</Text>
              </View>
            )}
          </View>

          <Text style={styles.docRequestTitle}>{request.title}</Text>
          <Text style={styles.docRequestDescription} numberOfLines={2}>
            {request.description}
          </Text>

          <View style={styles.docRequestMeta}>
            <View style={styles.docRequestMetaItem}>
              <Clock size={14} color={COLORS.gray[500]} />
              <Text style={styles.docRequestMetaText}>Due: {formatDate(request.dueDate)}</Text>
            </View>
            <View style={styles.docRequestMetaItem}>
              <User size={14} color={COLORS.gray[500]} />
              <Text style={styles.docRequestMetaText}>From: {request.requestedFrom.name}</Text>
            </View>
          </View>

          {request.documents.length > 0 && (
            <View style={styles.docRequestDocs}>
              <Paperclip size={14} color={COLORS.gray[500]} />
              <Text style={styles.docRequestDocsText}>
                {request.documents.length} document{request.documents.length > 1 ? 's' : ''} submitted
              </Text>
            </View>
          )}

          {(request.status === 'pending' || request.status === 'resubmit_needed') && (
            <View style={styles.docRequestAction}>
              <Text style={styles.docRequestActionText}>Tap to upload document</Text>
              <ChevronRight size={16} color={COLORS.primary} />
            </View>
          )}
        </TouchableOpacity>
      ))}

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.uploadModal}>
            <View style={styles.uploadModalHeader}>
              <Text style={styles.modalTitle}>Upload Document</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <X size={24} color={COLORS.gray[500]} />
              </TouchableOpacity>
            </View>

            {selectedRequest && (
              <>
                <Text style={styles.uploadRequestTitle}>{selectedRequest.title}</Text>
                <Text style={styles.uploadRequestDesc}>{selectedRequest.description}</Text>

                {selectedRequest.acceptedFormats && selectedRequest.acceptedFormats.length > 0 && (
                  <Text style={styles.acceptedFormats}>
                    Accepted formats: {selectedRequest.acceptedFormats.join(', ')}
                  </Text>
                )}

                <TextInput
                  style={styles.uploadNote}
                  placeholder="Add a note (optional)"
                  placeholderTextColor={COLORS.gray[400]}
                  value={uploadNote}
                  onChangeText={setUploadNote}
                  multiline
                  numberOfLines={2}
                />

                <TouchableOpacity
                  style={[styles.uploadButton, submitDocument.isPending && styles.uploadButtonDisabled]}
                  onPress={handlePickDocument}
                  disabled={submitDocument.isPending}
                >
                  {submitDocument.isPending ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Download size={20} color={COLORS.white} />
                      <Text style={styles.uploadButtonText}>Select & Upload Document</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.uploadCancelButton}
              onPress={() => setShowUploadModal(false)}
            >
              <Text style={styles.uploadCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// Activity Tab
function ActivityTab({
  activities,
  hasMore,
  onLoadMore,
}: {
  activities: ActivityDto[];
  hasMore: boolean;
  onLoadMore?: () => void;
}) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'notice_created':
      case 'notice_uploaded':
        return <FileText size={16} color={COLORS.primary} />;
      case 'notice_updated':
        return <FileText size={16} color={COLORS.info} />;
      case 'status_changed':
        return <AlertCircle size={16} color={COLORS.warning} />;
      case 'comment_added':
        return <MessageSquare size={16} color={COLORS.success} />;
      case 'task_created':
      case 'task_updated':
        return <CheckCircle size={16} color={COLORS.primary} />;
      case 'assigned':
        return <User size={16} color={COLORS.info} />;
      case 'response_submitted':
      case 'response_approved':
        return <Send size={16} color={COLORS.success} />;
      default:
        return <Clock size={16} color={COLORS.gray[400]} />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const groupActivitiesByDate = (items: ActivityDto[]) => {
    const groups: { [key: string]: ActivityDto[] } = {};
    items.forEach((item) => {
      const date = new Date(item.timestamp).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return groups;
  };

  if (activities.length === 0) {
    return (
      <EmptyState
        title="No Activity Yet"
        message="Activity history will appear here as actions are taken on this notice."
        icon={<Clock size={48} color={COLORS.gray[400]} />}
      />
    );
  }

  const groupedActivities = groupActivitiesByDate(activities);

  return (
    <View style={styles.activityContainer}>
      {Object.entries(groupedActivities).map(([date, items]) => (
        <View key={date} style={styles.activityGroup}>
          <Text style={styles.activityDate}>{date}</Text>
          {items.map((activity) => (
            <View key={activity.id} style={styles.activityItem}>
              <View style={styles.activityIconContainer}>
                {getActivityIcon(activity.type)}
              </View>
              <View style={styles.activityContent}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityActor}>{activity.actor?.name || 'System'}</Text>
                  <Text style={styles.activityTime}>{formatTimestamp(activity.timestamp)}</Text>
                </View>
                <Text style={styles.activityMessage}>{activity.message}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}

      {hasMore && onLoadMore && (
        <TouchableOpacity style={styles.loadMoreButton} onPress={onLoadMore}>
          <Text style={styles.loadMoreText}>Load More</Text>
        </TouchableOpacity>
      )}
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
  viewPdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primaryLight,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  viewPdfButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.primary,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    marginBottom: SPACING.lg,
  },
  transitionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  transitionContent: {
    flex: 1,
  },
  transitionLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[900],
  },
  transitionDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  cancelButton: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    fontWeight: '500',
  },
  // Comment compose styles
  commentsContainer: {
    flex: 1,
  },
  commentsList: {
    marginBottom: SPACING.md,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginTop: SPACING.md,
  },
  commentInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
    maxHeight: 100,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.gray[200],
  },
  // Task create styles
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  addTaskButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.primary,
  },
  createTaskModal: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    maxHeight: '80%',
  },
  createTaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  createTaskTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  taskTitleInput: {
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  taskDescriptionInput: {
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
    marginBottom: SPACING.md,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  priorityLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[700],
    marginBottom: SPACING.sm,
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  priorityOptionActive: {
    borderWidth: 1.5,
  },
  priorityOptionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[600],
  },
  priorityOptionTextActive: {
    color: COLORS.white,
  },
  createTaskActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  createTaskCancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
  },
  createTaskCancelText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[600],
  },
  createTaskSubmitButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  createTaskSubmitDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  createTaskSubmitText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.white,
  },
  // Attachments modal styles
  attachmentsModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    maxHeight: '70%',
  },
  attachmentsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  attachmentsList: {
    maxHeight: 400,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
    gap: SPACING.md,
  },
  attachmentIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[900],
  },
  attachmentSize: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  attachmentsCloseButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  attachmentsCloseText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[600],
  },
  // Document Requests styles
  docSummary: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    flexWrap: 'wrap',
  },
  docSummaryBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  docSummaryText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  docRequestItem: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  docRequestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  docRequestStatus: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  docRequestStatusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.white,
  },
  overdueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  overdueText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
    fontWeight: '500',
  },
  docRequestTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: SPACING.xs,
  },
  docRequestDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: SPACING.sm,
  },
  docRequestMeta: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  docRequestMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  docRequestMetaText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  docRequestDocs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  docRequestDocsText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
  docRequestAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  docRequestActionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  uploadModal: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  uploadModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  uploadRequestTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: SPACING.xs,
  },
  uploadRequestDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: SPACING.md,
  },
  acceptedFormats: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    fontStyle: 'italic',
    marginBottom: SPACING.md,
  },
  uploadNote: {
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
    marginBottom: SPACING.md,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  uploadButtonDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  uploadButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  uploadCancelButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  uploadCancelText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
  },
  // Response Tab styles
  responseContainer: {
    flex: 1,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  responseStatusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  responseStatusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.white,
    textTransform: 'uppercase',
  },
  responseVersion: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  draftEditorContainer: {
    marginBottom: SPACING.md,
  },
  draftLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[700],
    marginBottom: SPACING.xs,
  },
  draftEditor: {
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
    minHeight: 200,
    maxHeight: 400,
  },
  responseActions: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  responseActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  saveDraftButton: {
    backgroundColor: COLORS.gray[100],
  },
  saveDraftButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[700],
  },
  submitButton: {
    backgroundColor: COLORS.warning,
  },
  submitButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.white,
  },
  approveButton: {
    backgroundColor: COLORS.success,
  },
  approveButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.white,
  },
  markSubmittedButton: {
    backgroundColor: COLORS.primary,
  },
  markSubmittedButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.white,
  },
  reviewNotesContainer: {
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  reviewNotesLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: SPACING.xs,
  },
  reviewNotesText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
    lineHeight: 22,
  },
  reviewedBy: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  submitModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  submitNotesInput: {
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: SPACING.lg,
  },
  submitModalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  submitModalCancel: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
  },
  submitModalCancelText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[600],
  },
  submitModalConfirm: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  submitModalConfirmText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.white,
  },
  // Activity Tab styles
  activityContainer: {
    flex: 1,
  },
  activityGroup: {
    marginBottom: SPACING.lg,
  },
  activityDate: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray[500],
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityItem: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.gray[200],
    marginLeft: SPACING.sm,
    paddingLeft: SPACING.md,
  },
  activityIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  activityActor: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  activityTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
  },
  activityMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    lineHeight: 18,
  },
  loadMoreButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
    marginTop: SPACING.sm,
  },
  loadMoreText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.primary,
  },
  // Enhanced Comment styles
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  visibilityBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  visibilityBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
  },
  mentionText: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  commentComposeContainer: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  visibilityToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
  },
  visibilityOption: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md - 2,
  },
  visibilityOptionActive: {
    backgroundColor: COLORS.info,
  },
  visibilityOptionActivePublic: {
    backgroundColor: COLORS.warning,
  },
  visibilityOptionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[600],
  },
  visibilityOptionTextActive: {
    color: COLORS.white,
  },
});
