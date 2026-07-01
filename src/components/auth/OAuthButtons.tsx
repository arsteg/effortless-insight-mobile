/**
 * OAuth Buttons Component
 * Displays Google and Microsoft OAuth login buttons
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Svg, Path } from 'react-native-svg';

import { authApi } from '../../services/api';
import { OAuthProviderInfo } from '../../types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';

// Ensure WebBrowser sessions are dismissed properly
WebBrowser.maybeCompleteAuthSession();

// Google Icon SVG
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

// Microsoft Icon SVG
function MicrosoftIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M11.4 24H0V12.6h11.4V24z" fill="#00A4EF" />
      <Path d="M24 24H12.6V12.6H24V24z" fill="#FFB900" />
      <Path d="M11.4 11.4H0V0h11.4v11.4z" fill="#F25022" />
      <Path d="M24 11.4H12.6V0H24v11.4z" fill="#7FBA00" />
    </Svg>
  );
}

const providerIcons: Record<string, React.FC<{ size?: number }>> = {
  google: GoogleIcon,
  microsoft: MicrosoftIcon,
};

interface OAuthButtonsProps {
  mode?: 'login' | 'register';
  disabled?: boolean;
  onSuccess: (response: {
    accessToken: string;
    refreshToken: string;
    user: any;
    requires2fa?: boolean;
    partialToken?: string;
  }) => void;
  onError: (error: string) => void;
}

export function OAuthButtons({
  mode = 'login',
  disabled = false,
  onSuccess,
  onError,
}: OAuthButtonsProps) {
  const [providers, setProviders] = useState<OAuthProviderInfo[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get the redirect URI for OAuth callback
  const redirectUri = Linking.createURL('auth/oauth-callback');

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await authApi.getOAuthProviders();
      setProviders(response.providers.filter((p) => p.enabled));
    } catch (error) {
      console.error('Failed to fetch OAuth providers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (providerId: string) => {
    setLoadingProvider(providerId);

    try {
      // Get the OAuth login URL from the backend, passing the mobile redirect URI
      const response = await authApi.getOAuthLoginUrl(providerId, {
        redirectUri: redirectUri,
      });
      const { loginUrl, state } = response;

      // Open the OAuth provider's login page in a browser
      const result = await WebBrowser.openAuthSessionAsync(
        loginUrl,
        redirectUri,
        {
          showInRecents: true,
        }
      );

      if (result.type === 'success' && result.url) {
        // Parse the callback URL
        const url = new URL(result.url);
        const error = url.searchParams.get('error');

        if (error) {
          throw new Error(url.searchParams.get('error_description') || 'OAuth authentication failed');
        }

        // Check if we received tokens directly (from web callback redirect)
        const accessToken = url.searchParams.get('accessToken');
        const refreshToken = url.searchParams.get('refreshToken');

        if (accessToken && refreshToken) {
          // Tokens received directly from web callback - fetch user profile
          const profile = await authApi.getProfile();
          onSuccess({
            accessToken,
            refreshToken,
            user: profile,
          });
        } else {
          // Fallback: received authorization code, exchange it for tokens
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');

          if (!code) {
            throw new Error('No authorization code or tokens received');
          }

          // Send the code to our backend to exchange for tokens
          const callbackResponse = await authApi.handleOAuthCallback(providerId, {
            code,
            state: returnedState || state,
          });

          // Pass the response to the parent component
          onSuccess({
            accessToken: callbackResponse.accessToken,
            refreshToken: callbackResponse.refreshToken,
            user: callbackResponse.user,
            requires2fa: callbackResponse.requires2fa,
            partialToken: callbackResponse.partialToken,
          });
        }
      } else if (result.type === 'cancel') {
        // User cancelled the OAuth flow
        console.log('OAuth flow cancelled by user');
      }
    } catch (error) {
      console.error(`OAuth ${providerId} error:`, error);
      onError(
        error instanceof Error
          ? error.message
          : `Failed to sign in with ${providerId}`
      );
    } finally {
      setLoadingProvider(null);
    }
  };

  // Don't render anything while loading or if no providers are enabled
  if (isLoading || providers.length === 0) {
    return null;
  }

  const actionText = mode === 'login' ? 'Sign in' : 'Sign up';

  return (
    <View style={styles.container}>
      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* OAuth Buttons */}
      <View style={styles.buttonsContainer}>
        {providers.map((provider) => {
          const Icon = providerIcons[provider.name];
          const isProviderLoading = loadingProvider === provider.name;

          return (
            <TouchableOpacity
              key={provider.name}
              style={[
                styles.oauthButton,
                (disabled || loadingProvider !== null) && styles.disabledButton,
              ]}
              onPress={() => handleOAuthLogin(provider.name)}
              disabled={disabled || loadingProvider !== null}
              activeOpacity={0.7}
            >
              {isProviderLoading ? (
                <ActivityIndicator size="small" color={COLORS.gray[600]} />
              ) : Icon ? (
                <Icon size={20} />
              ) : null}
              <Text style={styles.oauthButtonText}>
                {actionText} with {provider.displayName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.gray[200],
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    color: COLORS.gray[500],
    fontSize: FONT_SIZES.sm,
    textTransform: 'uppercase',
  },
  buttonsContainer: {
    gap: SPACING.sm,
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    backgroundColor: COLORS.white,
    gap: SPACING.sm,
  },
  disabledButton: {
    opacity: 0.5,
  },
  oauthButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[700],
  },
});
