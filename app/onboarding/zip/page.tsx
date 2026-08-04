import type { Metadata } from "next";
import { OnboardingZipForm } from "@/components/auth/onboarding-zip-form";

export const metadata: Metadata = {
  title: "Welcome",
};

export default function OnboardingZipPage() {
  return <OnboardingZipForm />;
}
