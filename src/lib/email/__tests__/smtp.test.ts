import { describe, it, expect } from "vitest";
import { inferSmtpHost } from "../smtp";

describe("inferSmtpHost", () => {
  it("returns Gmail SMTP settings for gmail.com", () => {
    const result = inferSmtpHost("user@gmail.com");
    expect(result.host).toBe("smtp.gmail.com");
    expect(result.port).toBe(587);
  });

  it("returns Gmail SMTP settings for googlemail.com", () => {
    const result = inferSmtpHost("user@googlemail.com");
    expect(result.host).toBe("smtp.gmail.com");
    expect(result.port).toBe(587);
  });

  it("returns Outlook SMTP settings for outlook.com", () => {
    const result = inferSmtpHost("user@outlook.com");
    expect(result.host).toBe("smtp-mail.outlook.com");
    expect(result.port).toBe(587);
  });

  it("returns Outlook SMTP settings for hotmail.com", () => {
    const result = inferSmtpHost("user@hotmail.com");
    expect(result.host).toBe("smtp-mail.outlook.com");
    expect(result.port).toBe(587);
  });

  it("returns Outlook SMTP settings for live.com", () => {
    const result = inferSmtpHost("user@live.com");
    expect(result.host).toBe("smtp-mail.outlook.com");
    expect(result.port).toBe(587);
  });

  it("returns Office 365 SMTP for .onmicrosoft.com domains", () => {
    const result = inferSmtpHost("user@mycompany.onmicrosoft.com");
    expect(result.host).toBe("smtp.office365.com");
    expect(result.port).toBe(587);
  });

  it("uses smtp.<domain> as fallback for unknown custom domains", () => {
    const result = inferSmtpHost("finance@myagency.co.uk");
    expect(result.host).toBe("smtp.myagency.co.uk");
    expect(result.port).toBe(587);
  });

  it("always uses port 587 (STARTTLS)", () => {
    const domains = ["gmail.com", "outlook.com", "mycompany.com", "studio.io"];
    for (const domain of domains) {
      expect(inferSmtpHost(`user@${domain}`).port).toBe(587);
    }
  });
});
