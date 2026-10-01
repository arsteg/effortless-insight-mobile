/**
 * Unit tests for the assistant API service: envelope unwrapping and
 * the X-Platform header on chat turns.
 */

import { assistantApi } from '../services/api/assistant';
import { apiClient } from '../services/api/client';

jest.mock('../services/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
  getApiErrorMessage: jest.fn(() => 'error'),
}));

const getMock = apiClient.get as jest.Mock;
const postMock = apiClient.post as jest.Mock;

describe('assistantApi', () => {
  beforeEach(() => jest.clearAllMocks());

  it('unwraps the {success, data} envelope on conversation list', async () => {
    getMock.mockResolvedValueOnce({
      data: { success: true, data: { conversations: [], totalCount: 0, page: 1, pageSize: 20 } },
    });
    const result = await assistantApi.getConversations();
    expect(result.totalCount).toBe(0);
    expect(getMock).toHaveBeenCalledWith('/assistant/conversations?page=1&pageSize=20');
  });

  it('creates conversations with platform=mobile', async () => {
    postMock.mockResolvedValueOnce({ data: { success: true, data: { id: 'c1', messages: [] } } });
    await assistantApi.createConversation();
    expect(postMock).toHaveBeenCalledWith('/assistant/conversations', {
      title: null,
      platform: 'mobile',
    });
  });

  it('sends chat turns via the sync endpoint with the X-Platform header', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          userMessage: { id: 'u1' },
          assistantMessage: { id: 'a1', content: 'hi' },
        },
      },
    });

    const turn = await assistantApi.sendMessage('c1', { content: 'hello', context: null });

    expect(turn.assistantMessage.content).toBe('hi');
    expect(postMock).toHaveBeenCalledWith(
      '/assistant/conversations/c1/messages/sync',
      { content: 'hello', context: null },
      { headers: { 'X-Platform': 'mobile' } }
    );
  });
});
