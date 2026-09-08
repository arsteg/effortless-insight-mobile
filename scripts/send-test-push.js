#!/usr/bin/env node
/**
 * Send a test push through Firebase Cloud Messaging (HTTP v1).
 *
 * Uses the service-account JSON directly and signs its own OAuth2 assertion, so
 * it needs no npm packages — just Node. The payload mirrors what the API sends
 * in Services/Notifications/ChannelServices.cs (top-level `notification` plus
 * `apns` and `android` blocks) so a passing test here means the real send path
 * will behave the same way.
 *
 * Usage:
 *   node scripts/send-test-push.js --check
 *       Verify the credentials reach FCM. Sends nothing. No device needed.
 *
 *   node scripts/send-test-push.js --token <FCM_DEVICE_TOKEN>
 *       Deliver a real notification to that device.
 *
 *   node scripts/send-test-push.js --token <TOKEN> --dry-run
 *       Validate the token + payload without delivering.
 *
 * Options:
 *   --key <path>    service account JSON (default ./fcm-service-account.json)
 *   --title <text>  notification title
 *   --body <text>   notification body
 *
 * Getting a device token: run a DEV BUILD on a physical iPhone (Expo Go and the
 * Simulator cannot receive push) and read the token from the "Registered new
 * push token" log line on the API, or from the PushTokens table.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

function parseArgs(argv) {
  const args = { key: "fcm-service-account.json" };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") args.check = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--token") args.token = argv[++i];
    else if (arg === "--key") args.key = argv[++i];
    else if (arg === "--title") args.title = argv[++i];
    else if (arg === "--body") args.body = argv[++i];
    else {
      console.error(`Unknown option: ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

const base64url = (input) =>
  Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

/** Mint an access token using the JWT-bearer flow (RFC 7523). */
async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: FCM_SCOPE,
      aud: serviceAccount.token_uri,
      iat: now,
      exp: now + 3600,
    })
  );

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer
    .sign(serviceAccount.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const response = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      `Token request failed (${response.status}): ${body.error} - ${body.error_description || ""}`
    );
  }
  return body.access_token;
}

function buildMessage({ token, title, body }) {
  return {
    token,
    notification: { title, body },
    data: { type: "test", priority: "high" },
    // Mirrors BuildApnsConfig / BuildAndroidConfig on the API.
    apns: {
      payload: {
        aps: { alert: { title, body }, sound: "default", badge: 1 },
      },
    },
    android: {
      priority: "high",
      notification: { sound: "default", channelId: "deadline-regular" },
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const keyPath = path.resolve(args.key);

  if (!fs.existsSync(keyPath)) {
    console.error(`Service account not found: ${keyPath}`);
    console.error("Pass one with --key <path>.");
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  const projectId = serviceAccount.project_id;
  console.log(`Project      : ${projectId}`);
  console.log(`Service acct : ${serviceAccount.client_email}`);

  let accessToken;
  try {
    accessToken = await getAccessToken(serviceAccount);
    console.log("Credentials  : OK (access token minted)");
  } catch (error) {
    console.error(`Credentials  : FAILED - ${error.message}`);
    process.exit(1);
  }

  if (args.check && !args.token) {
    // Probe FCM with a deliberately invalid token. Reaching token *validation*
    // proves auth, project access and API enablement are all fine — the only
    // remaining unknown is a real device token.
    const probe = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          validate_only: true,
          message: buildMessage({
            token: "PROBE_INVALID_TOKEN",
            title: "probe",
            body: "probe",
          }),
        }),
      }
    );
    const result = await probe.json();
    const status = result?.error?.status;
    const reason = result?.error?.details?.[0]?.errorCode;

    if (probe.status === 400 && (reason === "INVALID_ARGUMENT" || status === "INVALID_ARGUMENT")) {
      console.log("FCM API      : OK (reached token validation)");
      console.log("\nFirebase side is working. Supply --token <device token> to deliver a real push.");
      return;
    }
    if (status === "PERMISSION_DENIED" || status === "UNAUTHENTICATED") {
      console.error(`FCM API      : FAILED - ${status}`);
      console.error("The service account cannot send for this project. Check its IAM roles");
      console.error("and that Firebase Cloud Messaging API is enabled.");
      process.exit(1);
    }
    console.log(`FCM API      : unexpected response`);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!args.token) {
    console.error("\nNo --token given. Use --check to verify credentials, or pass a device token.");
    process.exit(2);
  }

  const title = args.title || "EffortlessInsight test";
  const body = args.body || "If you can see this, push notifications are working.";

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...(args.dryRun ? { validate_only: true } : {}),
        message: buildMessage({ token: args.token, title, body }),
      }),
    }
  );

  const result = await response.json();
  if (response.ok) {
    console.log(args.dryRun ? "Validated    : OK (nothing delivered)" : "Sent         : OK");
    console.log(`Message name : ${result.name}`);
    return;
  }

  const errorCode = result?.error?.details?.[0]?.errorCode || result?.error?.status;
  console.error(`Send         : FAILED (${response.status}) ${errorCode}`);
  console.error(result?.error?.message || JSON.stringify(result));

  if (errorCode === "UNREGISTERED" || errorCode === "INVALID_ARGUMENT") {
    console.error("\nThat token is not valid for this project. Common causes:");
    console.error("  - token came from a different Firebase project");
    console.error("  - app was reinstalled and the token rotated");
    console.error("  - an APNs token was registered instead of the FCM token");
  }
  if (errorCode === "THIRD_PARTY_AUTH_ERROR") {
    console.error("\nFCM could not authenticate with APNs. Upload the APNs .p8 key:");
    console.error("  Firebase console -> Project settings -> Cloud Messaging -> APNs Authentication Key");
  }
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
