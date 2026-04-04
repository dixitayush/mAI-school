"use client";

import { ApolloWrapper } from "@/components/ApolloWrapper";
import DashboardLayout from "@/components/DashboardLayout";

export default function StudentLayout({ children }) {
  return (
    <ApolloWrapper>
      <DashboardLayout userRole="student">{children}</DashboardLayout>
    </ApolloWrapper>
  );
}
