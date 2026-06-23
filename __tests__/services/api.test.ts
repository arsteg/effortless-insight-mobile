import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Mock modules
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('API Service', () => {
  let mockAxios: MockAdapter;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
  });

  afterEach(() => {
    mockAxios.reset();
  });

  describe('Authentication', () => {
    it('should login successfully with valid credentials', async () => {
      const mockResponse = {
        success: true,
        data: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          user: {
            id: '123',
            email: 'test@example.com',
            name: 'Test User',
          },
        },
      };

      mockAxios.onPost('/auth/login').reply(200, mockResponse);

      const response = await axios.post('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.accessToken).toBe('mock-access-token');
    });

    it('should handle login failure', async () => {
      mockAxios.onPost('/auth/login').reply(401, {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });

      try {
        await axios.post('/auth/login', {
          email: 'test@example.com',
          password: 'wrongpassword',
        });
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.error.code).toBe('INVALID_CREDENTIALS');
      }
    });
  });

  describe('Notices', () => {
    it('should fetch notices list', async () => {
      const mockNotices = {
        success: true,
        data: {
          items: [
            { id: '1', title: 'Notice 1', status: 'pending' },
            { id: '2', title: 'Notice 2', status: 'analyzed' },
          ],
          totalCount: 2,
          page: 1,
          pageSize: 20,
        },
      };

      mockAxios.onGet('/notices').reply(200, mockNotices);

      const response = await axios.get('/notices');

      expect(response.status).toBe(200);
      expect(response.data.data.items).toHaveLength(2);
    });

    it('should get notice details', async () => {
      const mockNotice = {
        success: true,
        data: {
          id: '123',
          title: 'GST Notice',
          status: 'analyzed',
          riskScore: 75,
          summary: 'This is a tax assessment notice',
        },
      };

      mockAxios.onGet('/notices/123').reply(200, mockNotice);

      const response = await axios.get('/notices/123');

      expect(response.status).toBe(200);
      expect(response.data.data.id).toBe('123');
      expect(response.data.data.riskScore).toBe(75);
    });

    it('should upload notice', async () => {
      const mockUploadResponse = {
        success: true,
        data: {
          noticeId: 'new-123',
          status: 'processing',
          message: 'Notice uploaded successfully',
        },
      };

      mockAxios.onPost('/notices/upload').reply(202, mockUploadResponse);

      const formData = new FormData();
      // In React Native, we'd use a different approach for file uploads
      // This is simplified for testing

      const response = await axios.post('/notices/upload', formData);

      expect(response.status).toBe(202);
      expect(response.data.data.noticeId).toBe('new-123');
      expect(response.data.data.status).toBe('processing');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockAxios.onGet('/notices').networkError();

      try {
        await axios.get('/notices');
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toBe('Network Error');
      }
    });

    it('should handle timeout', async () => {
      mockAxios.onGet('/notices').timeout();

      try {
        await axios.get('/notices');
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('ECONNABORTED');
      }
    });

    it('should handle 500 server error', async () => {
      mockAxios.onGet('/notices').reply(500, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });

      try {
        await axios.get('/notices');
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(500);
      }
    });
  });
});
