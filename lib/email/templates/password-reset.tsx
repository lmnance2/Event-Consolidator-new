import * as React from "react";

interface PasswordResetEmailProps {
  resetUrl: string;
}

export function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "40px 20px",
        color: "#1a1a1a",
      }}
    >
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
        Reset your password
      </h1>
      <p style={{ marginBottom: "24px", lineHeight: "1.6" }}>
        We received a request to reset the password for your Event Atlas account.
        Click the button below to choose a new password. This link expires in 1 hour.
      </p>
      <a
        href={resetUrl}
        style={{
          display: "inline-block",
          backgroundColor: "#0f172a",
          color: "#ffffff",
          padding: "12px 24px",
          borderRadius: "6px",
          textDecoration: "none",
          fontWeight: "600",
          fontSize: "14px",
        }}
      >
        Reset password
      </a>
      <p
        style={{
          marginTop: "32px",
          fontSize: "13px",
          color: "#6b7280",
          lineHeight: "1.6",
        }}
      >
        If you did not request a password reset, you can safely ignore this email.
        Your password will not be changed.
      </p>
      <p
        style={{
          marginTop: "8px",
          fontSize: "13px",
          color: "#6b7280",
          wordBreak: "break-all",
        }}
      >
        Or copy and paste this URL into your browser:{" "}
        <span style={{ color: "#0f172a" }}>{resetUrl}</span>
      </p>
    </div>
  );
}
