/**
 * The signed-in user's own profile resources.
 *
 * Same routes the web client uses, so one server contract serves both
 * (TC-MOB-064).
 */

import { apiClient } from './client';
import { ApiResponse } from '../../types';

interface AvatarResponse {
  avatarUrl: string;
}

export const usersApi = {
  /**
   * Upload or replace the avatar.
   *
   * The field name must be `avatar` — it is what the endpoint's `IFormFile`
   * parameter binds to, and a mismatch arrives as "No image provided".
   */
  uploadAvatar: async (file: { uri: string; type: string; name: string }): Promise<string> => {
    const formData = new FormData();
    formData.append('avatar', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as unknown as Blob);

    const response = await apiClient.post<ApiResponse<AvatarResponse>>('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data.avatarUrl;
  },

  /** Remove the avatar, falling back to initials. */
  deleteAvatar: async (): Promise<void> => {
    await apiClient.delete('/users/avatar');
  },
};
