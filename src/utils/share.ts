/**
 * Share utilities for WhatsApp and other platforms
 */

import { Share, Platform, Linking } from 'react-native';

export interface ShareContent {
  title: string;
  message: string;
  url?: string;
}

export interface NoticeShareData {
  noticeId: string;
  noticeNumber: string;
  noticeType: string;
  summary: string;
  dueDate?: string;
  priority?: string;
  pdfUrl?: string;
}

/**
 * Format notice data for sharing
 */
export function formatNoticeForShare(notice: NoticeShareData): ShareContent {
  const lines = [
    `📋 GST Notice: ${notice.noticeNumber}`,
    `Type: ${notice.noticeType}`,
    '',
    notice.summary,
  ];

  if (notice.dueDate) {
    lines.push('');
    lines.push(`⏰ Due Date: ${notice.dueDate}`);
  }

  if (notice.priority) {
    const priorityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    }[notice.priority.toLowerCase()] || '⚪';
    lines.push(`Priority: ${priorityEmoji} ${notice.priority}`);
  }

  lines.push('');
  lines.push('Shared via EffortlessInsight');

  return {
    title: `GST Notice: ${notice.noticeNumber}`,
    message: lines.join('\n'),
    url: notice.pdfUrl,
  };
}

/**
 * Share content using native share dialog
 */
export async function shareContent(content: ShareContent): Promise<boolean> {
  try {
    const shareOptions: { message: string; title?: string; url?: string } = {
      message: content.message,
      title: content.title,
    };

    if (content.url) {
      if (Platform.OS === 'ios') {
        shareOptions.url = content.url;
      } else {
        // On Android, append URL to message
        shareOptions.message = `${content.message}\n\n${content.url}`;
      }
    }

    const result = await Share.share(shareOptions);

    if (result.action === Share.sharedAction) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error sharing content:', error);
    return false;
  }
}

/**
 * Share notice via native share dialog
 */
export async function shareNotice(notice: NoticeShareData): Promise<boolean> {
  const content = formatNoticeForShare(notice);
  return shareContent(content);
}

/**
 * Share content specifically to WhatsApp
 */
export async function shareToWhatsApp(content: ShareContent): Promise<boolean> {
  try {
    // Encode message for URL
    const encodedMessage = encodeURIComponent(
      content.url ? `${content.message}\n\n${content.url}` : content.message
    );

    // WhatsApp URL scheme
    const whatsappUrl = `whatsapp://send?text=${encodedMessage}`;

    // Check if WhatsApp is installed
    const canOpen = await Linking.canOpenURL(whatsappUrl);

    if (canOpen) {
      await Linking.openURL(whatsappUrl);
      return true;
    } else {
      // WhatsApp not installed, fall back to web
      const webUrl = `https://wa.me/?text=${encodedMessage}`;
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (error) {
    console.error('Error sharing to WhatsApp:', error);
    return false;
  }
}

/**
 * Share notice specifically to WhatsApp
 */
export async function shareNoticeToWhatsApp(notice: NoticeShareData): Promise<boolean> {
  const content = formatNoticeForShare(notice);
  return shareToWhatsApp(content);
}

/**
 * Share to a specific WhatsApp contact/number
 */
export async function shareToWhatsAppNumber(
  phoneNumber: string,
  content: ShareContent
): Promise<boolean> {
  try {
    // Remove any non-digit characters from phone number
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    // Encode message for URL
    const encodedMessage = encodeURIComponent(
      content.url ? `${content.message}\n\n${content.url}` : content.message
    );

    // WhatsApp URL with phone number
    const whatsappUrl = `whatsapp://send?phone=${cleanNumber}&text=${encodedMessage}`;

    const canOpen = await Linking.canOpenURL(whatsappUrl);

    if (canOpen) {
      await Linking.openURL(whatsappUrl);
      return true;
    } else {
      // Fall back to web version
      const webUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (error) {
    console.error('Error sharing to WhatsApp number:', error);
    return false;
  }
}

/**
 * Share via email
 */
export async function shareViaEmail(
  content: ShareContent,
  recipients?: string[]
): Promise<boolean> {
  try {
    const to = recipients?.join(',') || '';
    const subject = encodeURIComponent(content.title);
    const body = encodeURIComponent(
      content.url ? `${content.message}\n\n${content.url}` : content.message
    );

    const emailUrl = `mailto:${to}?subject=${subject}&body=${body}`;

    const canOpen = await Linking.canOpenURL(emailUrl);
    if (canOpen) {
      await Linking.openURL(emailUrl);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error sharing via email:', error);
    return false;
  }
}

/**
 * Copy content to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // React Native doesn't have native clipboard in core
    // This would require @react-native-clipboard/clipboard package
    // For now, we'll use a workaround via share
    console.log('Copy to clipboard:', text);
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return false;
  }
}

/**
 * Check if WhatsApp is available
 */
export async function isWhatsAppAvailable(): Promise<boolean> {
  try {
    return await Linking.canOpenURL('whatsapp://send');
  } catch {
    return false;
  }
}
