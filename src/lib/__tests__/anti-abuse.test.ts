import { describe, it, expect } from "vitest";
import { isDisposableEmailDomain, isFreeEmailProvider, emailDomain } from "../anti-abuse";

describe("isDisposableEmailDomain", () => {
  it("blocks known disposable domains", () => {
    const disposable = [
      "test@mailinator.com",
      "test@guerrillamail.com",
      "test@10minutemail.com",
      "test@tempmail.com",
      "test@throwaway.email",
      "test@yopmail.com",
    ];
    for (const email of disposable) {
      expect(isDisposableEmailDomain(email), `expected ${email} to be blocked`).toBe(true);
    }
  });

  it("allows legitimate business emails", () => {
    const legit = [
      "jane@mycompany.co.uk",
      "finance@acmecorp.com",
      "accounts@studio.io",
      "zain@zentracollect.co.uk",
    ];
    for (const email of legit) {
      expect(isDisposableEmailDomain(email), `expected ${email} to be allowed`).toBe(false);
    }
  });

  it("allows Gmail and Outlook (free but not disposable)", () => {
    expect(isDisposableEmailDomain("user@gmail.com")).toBe(false);
    expect(isDisposableEmailDomain("user@outlook.com")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isDisposableEmailDomain("test@MAILINATOR.COM")).toBe(true);
  });
});

describe("isFreeEmailProvider", () => {
  it("flags Gmail as a free provider", () => {
    expect(isFreeEmailProvider("user@gmail.com")).toBe(true);
  });

  it("flags Yahoo as a free provider", () => {
    expect(isFreeEmailProvider("user@yahoo.com")).toBe(true);
  });

  it("flags Hotmail as a free provider", () => {
    expect(isFreeEmailProvider("user@hotmail.com")).toBe(true);
  });

  it("does not flag a custom business domain as free", () => {
    expect(isFreeEmailProvider("user@myagency.co.uk")).toBe(false);
  });
});

describe("emailDomain", () => {
  it("extracts the domain from an email address", () => {
    expect(emailDomain("user@example.com")).toBe("example.com");
  });

  it("lowercases the domain", () => {
    expect(emailDomain("user@EXAMPLE.COM")).toBe("example.com");
  });

  it("handles subdomains", () => {
    expect(emailDomain("user@mail.company.co.uk")).toBe("mail.company.co.uk");
  });
});
