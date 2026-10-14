// Only application-owned text is displayed; callback query values are untrusted.
const messages: Record<string, string> = {
  database_schema_outdated: 'The API database is missing or has outdated email-sync tables or columns. Apply the email-sync database migrations to the database used by the API, then reconnect.',
  database_auth_failed: 'The API could not authenticate its email connection operation with PostgreSQL. Your administrator must check the database credentials and connection configuration.',
  database_unavailable: 'The API could not reach PostgreSQL while completing the connection. Check that the database is running and reachable, then retry.',
  connection_lock_failed: 'The API could not acquire its database connection lock. Check the database connection configuration and restart the updated API, then reconnect.',
  connection_save_failed: 'The API could not save the connected account. Check database migrations and write permissions; the API logs identify the failed save step.',
  connection_lookup_failed: 'The API could not read connected accounts from the database. Check the database connection and email-sync migrations.',
  connection_context_invalid: 'The user or business associated with this connection is no longer valid. Sign in again, select your business and reconnect.',
  connection_conflict: 'Another connection already exists or changed during this attempt. Refresh the account list and reconnect the existing account.',
  token_encryption_failed: 'The API could not encrypt the email credentials. Your administrator must check the field-encryption configuration without replacing a working encryption key.',
  connection_audit_failed: 'The account may have been saved, but the API could not finish its audit record. Refresh the account list and ask your administrator to check audit logging.',
  invalid_client: 'The email provider rejected the application credentials. Ask your administrator to check the client ID and client secret Value (not the Secret ID).',
  client_secret_invalid: 'Microsoft rejected the client secret. In Microsoft Entra, copy the secret Value, not the Secret ID, into EmailSync.Outlook.ClientSecret and restart the API.',
  client_secret_expired: 'The Microsoft client secret has expired. Your administrator must create a new secret and update the API configuration.',
  provider_audience_mismatch: 'The Microsoft account types do not match the application configuration. Your administrator must align the app registration audience and TenantId.',
  invalid_grant: 'This authorization has expired or was already used. Start a new connection from this page.',
  invalid_state: 'This connection request expired or was already used. Start a new connection from this page.',
  access_denied: 'Email access was not granted. Connect again and allow the requested read-only access. Your Microsoft organization may require administrator approval.',
  permission_denied: 'You no longer have permission to manage email connections for this business. Ask a business owner or administrator to connect the account.',
  offline_access_required: 'The provider did not grant ongoing email access. Connect again and allow the requested permissions.',
  profile_failed: 'The provider could not return your mailbox address. Check account access and the required email/profile permissions, then reconnect.',
  invalid_scope: 'The email provider permissions are not configured correctly. Ask your administrator to check the required read-only scopes.',
  unauthorized_client: 'This application is not authorized for this account. Ask your administrator to check the provider app registration and account types.',
  sync_in_progress: 'This account is currently syncing. Wait for sync to finish, then connect again.',
  connection_in_progress: 'Another connection attempt is in progress. Wait a moment, then try again.',
  complete_failed: 'The API could not save or finish the email connection. Your administrator should check the API callback logs and database migrations.',
  exception: 'The API could not contact the email provider. Try again; if it continues, ask your administrator to check API connectivity.',
  token_exchange_failed: 'The provider could not complete authorization. Start a new connection; if it continues, ask your administrator to check the application credentials.',
  invalid_response: 'The email provider returned an unexpected response. Start a new connection or try again later.',
};

export function getEmailConnectionError(code: string): string {
  return Object.prototype.hasOwnProperty.call(messages, code)
    ? `${messages[code]} Reference: ${code}.`
    : 'The email connection could not be completed. Start a new connection or ask your administrator to check the API callback logs. Reference: connection_failed.';
}
