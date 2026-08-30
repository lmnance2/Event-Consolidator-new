import * as React from "react";

export interface EventInviteEmailProps {
  fromName: string | null;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  eventUrl: string;
}

export function EventInviteEmail({
  fromName,
  eventTitle,
  eventDate,
  eventTime,
  venueName,
  eventUrl,
}: EventInviteEmailProps) {
  const sender = fromName ?? "Someone";

  return (
    <html>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#fafafa",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
          color: "#2a1e15",
        }}
      >
        {/* Preheader: controls Gmail preview text */}
        <div
          style={{
            display: "none",
            overflow: "hidden",
            lineHeight: "1px",
            maxHeight: 0,
            maxWidth: 0,
            opacity: 0,
          }}
        >
          {sender} thinks you{"'"}d like this event: {eventTitle}
        </div>

        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          border={0}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: "32px 16px" }}>
                <table
                  role="presentation"
                  width={560}
                  cellPadding={0}
                  cellSpacing={0}
                  border={0}
                  style={{
                    maxWidth: "560px",
                    background: "#ffffff",
                    border: "1px solid #e7ded4",
                    borderRadius: "16px",
                    overflow: "hidden",
                  }}
                >
                  <tbody>
                    {/* Brand accent line */}
                    <tr>
                      <td
                        style={{
                          height: "4px",
                          background: "#c96b2c",
                          lineHeight: "4px",
                          fontSize: "4px",
                        }}
                      >
                        &nbsp;
                      </td>
                    </tr>

                    {/* Wordmark eyebrow */}
                    <tr>
                      <td style={{ padding: "24px 32px 0" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            color: "#8a7867",
                            fontWeight: 600,
                          }}
                        >
                          Event Atlas
                        </span>
                      </td>
                    </tr>

                    {/* Greeting */}
                    <tr>
                      <td style={{ padding: "20px 32px 8px" }}>
                        <p style={{ margin: 0, fontSize: "15px", color: "#4a3d31" }}>
                          {sender} thinks you{"'"}d like this event.
                        </p>
                      </td>
                    </tr>

                    {/* Event title */}
                    <tr>
                      <td style={{ padding: "8px 32px 12px" }}>
                        <h1
                          style={{
                            margin: 0,
                            fontSize: "24px",
                            lineHeight: 1.25,
                            fontWeight: 600,
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {eventTitle}
                        </h1>
                      </td>
                    </tr>

                    {/* Facts strip */}
                    <tr>
                      <td style={{ padding: "0 32px 24px" }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "14px",
                            lineHeight: 1.5,
                            color: "#4a3d31",
                          }}
                        >
                          {eventDate} &middot; {eventTime}
                          <br />
                          {venueName}
                        </p>
                      </td>
                    </tr>

                    {/* Primary CTA */}
                    <tr>
                      <td style={{ padding: "0 32px 32px" }}>
                        <table
                          role="presentation"
                          cellPadding={0}
                          cellSpacing={0}
                          border={0}
                        >
                          <tbody>
                            <tr>
                              <td
                                style={{
                                  background: "#c96b2c",
                                  borderRadius: "8px",
                                }}
                              >
                                <a
                                  href={eventUrl}
                                  style={{
                                    display: "inline-block",
                                    padding: "12px 20px",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    color: "#ffffff",
                                    textDecoration: "none",
                                  }}
                                >
                                  See event
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    {/* Footer */}
                    <tr>
                      <td
                        style={{
                          padding: "20px 32px",
                          borderTop: "1px solid #f0e8dd",
                          background: "#faf6f0",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "12px",
                            lineHeight: 1.5,
                            color: "#8a7867",
                          }}
                        >
                          You received this because a friend on Event Atlas sent you an invite.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
