import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { google } from "googleapis";
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];
const key = () => Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? "", "base64");
export const encrypt = (value: string) => {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv),
    body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body]
    .map((x) => x.toString("base64url"))
    .join(".");
};
export const decrypt = (value: string) => {
  const [a, b, c] = value.split(".");
  if (!a || !b || !c) throw new Error("Invalid encrypted token");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(a, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(b, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(c, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};
export type GoogleAuthClient = InstanceType<typeof google.auth.OAuth2>;
export const googleClient = (tokens: {
  accessToken?: string;
  refreshToken?: string;
}): GoogleAuthClient => {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BETTER_AUTH_URL}/api/auth/callback/google`,
  );
  client.setCredentials({
    ...(tokens.accessToken ? { access_token: tokens.accessToken } : {}),
    ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
  });
  return client;
};
export const listRecentMessages = async (
  auth: ReturnType<typeof googleClient>,
) => {
  const gmail = google.gmail({ version: "v1", auth });
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: 25,
    q: "newer_than:14d",
  });
  return Promise.all(
    (list.data.messages ?? []).map(async (item) => {
      const data = (
        await gmail.users.messages.get({
          userId: "me",
          id: item.id!,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        })
      ).data;
      const headers = Object.fromEntries(
        (data.payload?.headers ?? []).map((h) => [
          h.name?.toLowerCase(),
          h.value,
        ]),
      );
      return {
        gmailMessageId: data.id!,
        gmailThreadId: data.threadId ?? undefined,
        sender: headers.from ?? "Unknown sender",
        subject: headers.subject ?? "(No subject)",
        receivedAt: new Date(Number(data.internalDate)),
        preview: data.snippet ?? "",
        unread: data.labelIds?.includes("UNREAD") ?? false,
      };
    }),
  );
};
export const startGmailWatch = async (auth: GoogleAuthClient, topicName: string) => {
  const response = await google.gmail({ version: "v1", auth }).users.watch({
    userId: "me",
    requestBody: { topicName, labelIds: ["INBOX"], labelFilterBehavior: "include" },
  });
  if (!response.data.historyId || !response.data.expiration)
    throw new Error("Gmail did not return watch metadata");
  return { historyId: response.data.historyId, expiresAt: new Date(Number(response.data.expiration)) };
};
export const verifyGooglePushToken = async (
  token: string,
  audience: string,
): Promise<{ email?: string; email_verified?: boolean } | undefined> => {
  const ticket = await new google.auth.OAuth2().verifyIdToken({ idToken: token, audience });
  return ticket.getPayload();
};
export const listUpcomingEvents = async (auth: GoogleAuthClient) => {
  const calendar = google.calendar({ version: "v3", auth }),
    response = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });
  return (response.data.items ?? []).flatMap((item) => {
    const start = item.start?.dateTime ?? item.start?.date,
      end = item.end?.dateTime ?? item.end?.date;
    if (!item.id || !start || !end) return [];
    return [
      {
        googleEventId: item.id,
        title: item.summary ?? "Untitled event",
        startAt: new Date(start),
        endAt: new Date(end),
        attendees: (item.attendees ?? []).flatMap((attendee) =>
          attendee.email ? [attendee.email] : [],
        ),
      },
    ];
  });
};
